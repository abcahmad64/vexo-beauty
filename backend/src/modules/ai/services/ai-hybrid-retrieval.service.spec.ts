import type { AiBudgetEnforcementService } from './ai-budget-enforcement.service';
import type { AiRerankerClientService } from './ai-reranker-client.service';
import { AiHybridRetrievalService } from './ai-hybrid-retrieval.service';
import type { AiRunLogService } from './ai-run-log.service';
import type { OllamaClientService } from './ollama-client.service';

const objectContaining = <T extends object>(value: T): T =>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Jest asymmetric matcher types expose any; this boundary is test-only.
  expect.objectContaining(value) as unknown as T;

type BudgetEnforcementMock = jest.Mocked<
  Pick<
    AiBudgetEnforcementService,
    'estimateEmbedding' | 'reserve' | 'reconcile'
  >
>;

type OllamaClientMock = jest.Mocked<Pick<OllamaClientService, 'embed'>>;

type RerankerMock = jest.Mocked<Pick<AiRerankerClientService, 'rerank'>>;

type RunLogMock = jest.Mocked<
  Pick<AiRunLogService, 'startRun' | 'markSuccess' | 'markFailure'>
>;

describe('AiHybridRetrievalService provider accounting', () => {
  it('records embedding token usage with tool attribution', async () => {
    const ollamaClient: OllamaClientMock = {
      embed: jest
        .fn()
        .mockResolvedValueOnce({
          embeddings: [[1, 0]],
          model: 'qwen3-embedding:4b',
          raw: {},
          tokenUsage: {
            promptEvalCount: 3,
          },
        })
        .mockResolvedValueOnce({
          embeddings: [[1, 0]],
          model: 'qwen3-embedding:4b',
          raw: {},
          tokenUsage: {
            promptEvalCount: 5,
          },
        }),
    };
    const budgetEnforcement: BudgetEnforcementMock = {
      estimateEmbedding: jest.fn().mockReturnValue({
        pricingStatus: 'CALCULATED',
        estimatedCostMicros: '0',
        estimatedInputTokens: 3,
        estimatedOutputTokens: 0,
      }),
      reserve: jest.fn().mockResolvedValue({
        version: '1.0.0',
        decision: 'ALLOW',
        reservationId: 'embedding-reservation',
        policyDecisions: [],
        estimate: {
          pricingStatus: 'CALCULATED',
          estimatedCostMicros: '0',
          estimatedInputTokens: 3,
          estimatedOutputTokens: 0,
        },
      }),
      reconcile: jest.fn().mockResolvedValue(undefined),
    };
    const reranker: RerankerMock = {
      rerank: jest.fn().mockResolvedValue([
        {
          id: 'doc-1',
          score: 0.9,
        },
      ]),
    };
    const runLog: RunLogMock = {
      startRun: jest
        .fn()
        .mockResolvedValueOnce('embed-run-1')
        .mockResolvedValueOnce('embed-run-2'),
      markSuccess: jest.fn().mockResolvedValue(undefined),
      markFailure: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AiHybridRetrievalService(
      ollamaClient as unknown as OllamaClientService,
      budgetEnforcement as unknown as AiBudgetEnforcementService,
      reranker as unknown as AiRerankerClientService,
      runLog as unknown as AiRunLogService,
    );

    const result = await service.rank({
      query: 'face serum',
      documents: [
        {
          id: 'doc-1',
          text: 'hydrating face serum',
          fingerprint: 'fingerprint-1',
          lexicalScore: 1,
          payload: {
            productId: 'product-1',
          },
        },
      ],
      limit: 1,
    });

    expect(result).toHaveLength(1);
    expect(runLog.startRun).toHaveBeenCalledTimes(2);
    expect(runLog.startRun).toHaveBeenNthCalledWith(
      1,
      objectContaining({
        taskType: 'EMBEDDING',
        provider: 'ollama',
        inputJson: objectContaining({
          source: 'ai-hybrid-retrieval',
          toolName: 'semantic-embedding',
          inputCount: 1,
        }),
      }),
    );
    expect(runLog.markSuccess).toHaveBeenCalledTimes(2);
    expect(runLog.markSuccess).toHaveBeenNthCalledWith(
      1,
      'embed-run-1',
      objectContaining({
        providerAccounting: objectContaining({
          aggregateUsage: objectContaining({
            inputTokens: 3,
          }),
          aggregateCostMicros: '0',
        }),
      }),
    );
    expect(runLog.markFailure).not.toHaveBeenCalled();
  });
});
