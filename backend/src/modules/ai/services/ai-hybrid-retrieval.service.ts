import { Injectable, Logger } from '@nestjs/common';

import { AiBudgetEnforcementService } from './ai-budget-enforcement.service';

import { AiRerankerClientService } from './ai-reranker-client.service';

import { AiProviderCostAccountingUtil } from './ai-provider-cost-accounting.util';

import { OllamaClientService } from './ollama-client.service';

import { AiRunLogService } from './ai-run-log.service';

export interface AiRetrievalDocument<T = Record<string, unknown>> {
  id: string;
  text: string;
  fingerprint: string;
  lexicalScore?: number;
  popularityScore?: number;
  payload: T;
}

export interface AiRankedDocument<
  T = Record<string, unknown>,
> extends AiRetrievalDocument<T> {
  semanticScore: number;
  rerankerScore: number | null;
  finalScore: number;
}

type CachedEmbedding = {
  fingerprint: string;
  vector: number[];
  touchedAt: number;
};

@Injectable()
export class AiHybridRetrievalService {
  private readonly logger = new Logger(AiHybridRetrievalService.name);

  private readonly embeddingModel =
    process.env.AI_OLLAMA_EMBEDDING_MODEL?.trim() || 'qwen3-embedding:4b';

  private readonly candidateLimit = this.readInteger(
    'AI_RETRIEVAL_CANDIDATE_LIMIT',
    36,
    4,
    100,
  );

  private readonly rerankLimit = this.readInteger(
    'AI_RETRIEVAL_RERANK_LIMIT',
    12,
    2,
    40,
  );

  private readonly embeddingBatchSize = this.readInteger(
    'AI_RETRIEVAL_EMBED_BATCH_SIZE',
    4,
    1,
    12,
  );

  private readonly cacheMaxEntries = this.readInteger(
    'AI_RETRIEVAL_CACHE_MAX_ENTRIES',
    1500,
    50,
    20_000,
  );

  private readonly embeddingCache = new Map<string, CachedEmbedding>();

  constructor(
    private readonly ollamaClient: OllamaClientService,
    private readonly budgetEnforcement: AiBudgetEnforcementService,
    private readonly rerankerClient: AiRerankerClientService,
    private readonly runLog: AiRunLogService,
  ) {}

  async rank<T>(input: {
    query: string;
    documents: AiRetrievalDocument<T>[];
    limit: number;
    instruction?: string;
  }): Promise<AiRankedDocument<T>[]> {
    const documents = input.documents
      .filter((document) => document.id.trim() && document.text.trim())
      .slice(0, this.candidateLimit);

    if (documents.length === 0) {
      return [];
    }

    const limit = Math.min(Math.max(input.limit, 1), documents.length);

    try {
      const semantic = await this.rankByEmbedding(input.query, documents);
      const rerankCandidates = semantic.slice(
        0,
        Math.min(this.rerankLimit, semantic.length),
      );

      try {
        const reranked = await this.rerankerClient.rerank({
          query: input.query,
          documents: rerankCandidates.map((document) => ({
            id: document.id,
            text: document.text,
            metadata: {
              semanticScore: document.semanticScore,
              lexicalScore: document.lexicalScore ?? 0,
            },
          })),
          topN: rerankCandidates.length,
          instruction: input.instruction,
        });

        const scoreById = new Map(
          reranked.map((result) => [result.id, result.score]),
        );

        return rerankCandidates
          .map((document) => {
            const rerankerScore = scoreById.get(document.id) ?? null;

            return {
              ...document,
              rerankerScore,
              finalScore:
                rerankerScore === null
                  ? document.finalScore
                  : this.clamp01(
                      rerankerScore * 0.68 +
                        document.semanticScore * 0.27 +
                        this.normalizeLexical(document.lexicalScore) * 0.05,
                    ),
            };
          })
          .sort((left, right) => right.finalScore - left.finalScore)
          .slice(0, limit);
      } catch (error) {
        this.logger.warn(
          `Reranker unavailable; semantic ordering is used: ${this.getErrorMessage(
            error,
          )}`,
        );

        return semantic.slice(0, limit);
      }
    } catch (error) {
      this.logger.warn(
        `Embedding retrieval unavailable; lexical ordering is used: ${this.getErrorMessage(
          error,
        )}`,
      );

      return documents
        .map((document) => ({
          ...document,
          semanticScore: 0,
          rerankerScore: null,
          finalScore: this.clamp01(
            this.normalizeLexical(document.lexicalScore) * 0.85 +
              this.normalizePopularity(document.popularityScore) * 0.15,
          ),
        }))
        .sort((left, right) => right.finalScore - left.finalScore)
        .slice(0, limit);
    }
  }

  private async rankByEmbedding<T>(
    query: string,
    documents: AiRetrievalDocument<T>[],
  ): Promise<AiRankedDocument<T>[]> {
    const missing = documents.filter((document) => {
      const cached = this.embeddingCache.get(document.id);

      return !cached || cached.fingerprint !== document.fingerprint;
    });

    const queryEmbeddings = await this.embedTexts([query]);
    const queryVector = queryEmbeddings[0];

    if (!queryVector) {
      throw new Error('Query embedding is missing.');
    }

    for (
      let start = 0;
      start < missing.length;
      start += this.embeddingBatchSize
    ) {
      const batch = missing.slice(start, start + this.embeddingBatchSize);
      const vectors = await this.embedTexts(
        batch.map((document) => document.text),
      );

      if (vectors.length !== batch.length) {
        throw new Error('Document embedding batch is incomplete.');
      }

      for (let index = 0; index < batch.length; index += 1) {
        const document = batch[index];
        const vector = vectors[index];

        if (!document || !vector) {
          throw new Error('Document embedding is missing.');
        }

        this.embeddingCache.set(document.id, {
          fingerprint: document.fingerprint,
          vector,
          touchedAt: Date.now(),
        });
      }
    }

    const now = Date.now();

    const ranked = documents.map((document) => {
      const cached = this.embeddingCache.get(document.id);

      if (!cached || cached.fingerprint !== document.fingerprint) {
        throw new Error(`Embedding cache miss for ${document.id}.`);
      }

      cached.touchedAt = now;

      const semanticScore = this.normalizeCosine(
        this.cosineSimilarity(queryVector, cached.vector),
      );

      const finalScore = this.clamp01(
        semanticScore * 0.78 +
          this.normalizeLexical(document.lexicalScore) * 0.17 +
          this.normalizePopularity(document.popularityScore) * 0.05,
      );

      return {
        ...document,
        semanticScore,
        rerankerScore: null,
        finalScore,
      };
    });

    this.trimCache();

    return ranked.sort((left, right) => right.finalScore - left.finalScore);
  }

  private async embedTexts(input: string[]): Promise<number[][]> {
    if (input.length === 0) {
      return [];
    }

    const startedAt = Date.now();
    let reservationId: string | null = null;
    const metadata = {
      source: 'ai-hybrid-retrieval',
      toolName: 'semantic-embedding',
    };
    const runLogId = await this.runLog.startRun({
      taskType: 'EMBEDDING',
      provider: 'ollama',
      model: this.embeddingModel,
      inputJson: {
        ...metadata,
        inputCount: input.length,
        inputCharacterCount: input.reduce(
          (sum, value) => sum + value.length,
          0,
        ),
      },
    });

    try {
      const reservation = await this.budgetEnforcement.reserve({
        runLogId,
        taskType: 'EMBEDDING',
        provider: 'ollama',
        model: this.embeddingModel,
        metadata,
        estimate: this.budgetEnforcement.estimateEmbedding({
          provider: 'ollama',
          model: this.embeddingModel,
          values: input,
        }),
        attemptSequence: 1,
        attemptKind: 'EMBEDDING',
      });
      reservationId = reservation.reservationId;

      const result = await this.ollamaClient.embed({
        model: this.embeddingModel,
        input,
        timeoutMs: 300_000,
        keepAlive: '5m',
        numCtx: 4096,
      });
      const attempt = AiProviderCostAccountingUtil.createAttempt({
        sequence: 1,
        kind: 'PRIMARY',
        status: 'SUCCESS',
        provider: 'ollama',
        model: result.model,
        rawUsage: result.tokenUsage,
        usageSource: 'OLLAMA_EMBEDDING',
        metadata,
        taskType: 'EMBEDDING',
      });
      await this.budgetEnforcement.reconcile({
        runLogId,
        reservationId,
        providerAttempt: attempt,
      });
      const providerAccounting = AiProviderCostAccountingUtil.summarize([
        attempt,
      ]);

      await this.runLog.markSuccess(runLogId, {
        outputJson: {
          embeddingCount: result.embeddings.length,
          dimensions: result.embeddings[0]?.length ?? 0,
        },
        latencyMs: Date.now() - startedAt,
        providerAccounting,
        model: result.model,
      });

      return result.embeddings;
    } catch (error) {
      const attempt = AiProviderCostAccountingUtil.createAttempt({
        sequence: 1,
        kind: 'PRIMARY',
        status: 'FAILED',
        provider: 'ollama',
        model: this.embeddingModel,
        usageSource: 'OLLAMA_EMBEDDING',
        metadata,
        taskType: 'EMBEDDING',
      });

      await this.budgetEnforcement.reconcile({
        runLogId,
        reservationId,
        providerAttempt: attempt,
      });

      await this.runLog.markFailure(runLogId, {
        outputJson: {
          source: 'ai-hybrid-retrieval',
          toolName: 'semantic-embedding',
        },
        latencyMs: Date.now() - startedAt,
        errorMessage: this.getErrorMessage(error),
        providerAccounting: AiProviderCostAccountingUtil.summarize([attempt]),
        model: this.embeddingModel,
      });

      throw error;
    }
  }

  private cosineSimilarity(left: number[], right: number[]): number {
    const length = Math.min(left.length, right.length);

    if (length === 0) {
      return 0;
    }

    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;

    for (let index = 0; index < length; index += 1) {
      const leftValue = left[index] ?? 0;
      const rightValue = right[index] ?? 0;

      dot += leftValue * rightValue;
      leftNorm += leftValue * leftValue;
      rightNorm += rightValue * rightValue;
    }

    if (leftNorm === 0 || rightNorm === 0) {
      return 0;
    }

    return dot / Math.sqrt(leftNorm * rightNorm);
  }

  private normalizeCosine(value: number): number {
    return this.clamp01((value + 1) / 2);
  }

  private normalizeLexical(value?: number): number {
    if (!value || value <= 0) {
      return 0;
    }

    return this.clamp01(1 - Math.exp(-value / 12));
  }

  private normalizePopularity(value?: number): number {
    if (!value || value <= 0) {
      return 0;
    }

    return this.clamp01(Math.log1p(value) / 12);
  }

  private trimCache(): void {
    if (this.embeddingCache.size <= this.cacheMaxEntries) {
      return;
    }

    const overflow = this.embeddingCache.size - this.cacheMaxEntries;

    const oldest = [...this.embeddingCache.entries()]
      .sort((left, right) => left[1].touchedAt - right[1].touchedAt)
      .slice(0, overflow);

    for (const [key] of oldest) {
      this.embeddingCache.delete(key);
    }
  }

  private clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }

  private readInteger(
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const raw = process.env[key];
    const parsed = raw ? Number(raw) : fallback;

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.trunc(Math.min(max, Math.max(min, parsed)));
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
