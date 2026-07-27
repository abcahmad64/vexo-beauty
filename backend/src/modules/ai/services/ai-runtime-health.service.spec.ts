import type {
  QueueMonitorService,
  QueueStatusReport,
} from '../../../core/queue/services/queue-monitor.service';

import type { AiAgentRegistryService } from './ai-agent-registry.service';
import type { AiCircuitBreakerService } from './ai-circuit-breaker.service';
import type { AiExecutionContextService } from './ai-execution-context.service';
import type { AiRerankerClientService } from './ai-reranker-client.service';
import type { AiRuntimeCoordinatorService } from './ai-runtime-coordinator.service';

import { AiRuntimeHealthService } from './ai-runtime-health.service';

import type { OllamaClientService } from './ollama-client.service';

const MODEL_ENV_KEYS = [
  'AI_OLLAMA_PUBLIC_MODEL',
  'AI_OLLAMA_CONTENT_MODEL',
  'AI_OLLAMA_VISION_MODEL',
  'AI_OLLAMA_EMBEDDING_MODEL',
  'AI_OLLAMA_FALLBACK_MODEL',
] as const;

const DEFAULT_REQUIRED_MODELS = [
  'qwen3.5:9b',
  'qwen3:14b',
  'qwen3-vl:8b',
  'qwen3-embedding:4b',
];

type OllamaHealthFixture = {
  ok: boolean;
  baseUrl: string;
  version: string | null;
  models: string[];
  error: string | null;
};

type RerankerHealthFixture = {
  ok: boolean;
  enabled: boolean;
  baseUrl: string;
  modelLoaded: boolean;
  modelName: string | null;
  modelPath: string | null;
  error: string | null;
};

type RuntimeSnapshotFixture = {
  maxConcurrent: number;
  activeCount: number;
  queueDepth: number;
  maxQueueDepth: number;
  queueTimeoutMs: number;
  activeExecutions: never[];
};

type AgentSnapshotFixture = {
  version: string;
  totalAgents: number;
};

type CircuitSnapshotFixture = {
  openCircuits: number;
  halfOpenCircuits: number;
  closedCircuits: number;
  totalCircuits: number;
};

type ExecutionSnapshotFixture = {
  version: string;
  registryEnforced: boolean;
  agentSpoofingProtection: boolean;
  correlationPropagation: boolean;
};

type OllamaMock = {
  health: jest.MockedFunction<() => Promise<OllamaHealthFixture>>;
};

type RerankerMock = {
  health: jest.MockedFunction<() => Promise<RerankerHealthFixture>>;
};

type RuntimeCoordinatorMock = {
  getSnapshot: jest.MockedFunction<() => RuntimeSnapshotFixture>;
};

type AgentRegistryMock = {
  getSnapshot: jest.MockedFunction<() => AgentSnapshotFixture>;
};

type CircuitBreakerMock = {
  getSnapshot: jest.MockedFunction<() => CircuitSnapshotFixture>;
};

type ExecutionContextMock = {
  getSnapshot: jest.MockedFunction<() => ExecutionSnapshotFixture>;
};

type QueueMonitorMock = {
  getStatus: jest.MockedFunction<() => Promise<QueueStatusReport>>;
};

type ServiceMocks = {
  ollama: OllamaMock;
  reranker: RerankerMock;
  runtimeCoordinator: RuntimeCoordinatorMock;
  agentRegistry: AgentRegistryMock;
  circuitBreaker: CircuitBreakerMock;
  executionContext: ExecutionContextMock;
  queueMonitor: QueueMonitorMock;
};

const createQueueReport = (
  level: 'HEALTHY' | 'WARNING' | 'DEGRADED' | 'CRITICAL',
): QueueStatusReport => ({
  version: '1.0.0',
  healthVersion: '1.0.0',
  checkedAt: '2026-07-26T10:00:00.000Z',
  queues: [],
  aggregate: {
    version: '1.0.0',
    queueCount: 9,
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    paused: 0,
    prioritized: 0,
    waitingChildren: 0,
    backlog: 0,
    workersCount: 0,
    pausedQueues: 0,
    historical: {
      completed: 0,
      failed: 0,
      sampleSize: 0,
      failureRatePercent: null,
      sufficientSample: false,
    },
  },
  health: {
    version: '1.0.0',
    level,
    ready: level === 'HEALTHY' || level === 'WARNING',
    degraded: level === 'DEGRADED' || level === 'CRITICAL',
    critical: level === 'CRITICAL',
    thresholds: {
      backlogWarningThreshold: 25,
      backlogCriticalThreshold: 100,
      failedWarningThreshold: 10,
      failedCriticalThreshold: 50,
      delayedWarningThreshold: 25,
      delayedCriticalThreshold: 100,
      failureRateWarningPercent: 20,
      failureRateCriticalPercent: 50,
      failureRateMinSample: 20,
    },
    queueLevels: {
      HEALTHY: level === 'HEALTHY' ? 9 : 8,
      WARNING: level === 'WARNING' ? 1 : 0,
      DEGRADED: level === 'DEGRADED' ? 1 : 0,
      CRITICAL: level === 'CRITICAL' ? 1 : 0,
    },
    affectedQueues: level === 'HEALTHY' ? [] : ['ai'],
    signals: [],
    workersCountEnforced: false,
    workersCountPolicy: 'INFORMATIONAL_ONLY',
  },
});

const createMocks = (): ServiceMocks => ({
  ollama: {
    health: jest.fn<Promise<OllamaHealthFixture>, []>().mockResolvedValue({
      ok: true,
      baseUrl: 'http://ollama.test',
      version: '0.11.0',
      models: [...DEFAULT_REQUIRED_MODELS],
      error: null,
    }),
  },
  reranker: {
    health: jest.fn<Promise<RerankerHealthFixture>, []>().mockResolvedValue({
      ok: true,
      enabled: true,
      baseUrl: 'http://reranker.test',
      modelLoaded: true,
      modelName: 'bge-reranker',
      modelPath: '/models/bge-reranker',
      error: null,
    }),
  },
  runtimeCoordinator: {
    getSnapshot: jest.fn<RuntimeSnapshotFixture, []>().mockReturnValue({
      maxConcurrent: 1,
      activeCount: 0,
      queueDepth: 0,
      maxQueueDepth: 24,
      queueTimeoutMs: 300_000,
      activeExecutions: [],
    }),
  },
  agentRegistry: {
    getSnapshot: jest.fn<AgentSnapshotFixture, []>().mockReturnValue({
      version: '1.0.0',
      totalAgents: 4,
    }),
  },
  circuitBreaker: {
    getSnapshot: jest.fn<CircuitSnapshotFixture, []>().mockReturnValue({
      openCircuits: 0,
      halfOpenCircuits: 0,
      closedCircuits: 1,
      totalCircuits: 1,
    }),
  },
  executionContext: {
    getSnapshot: jest.fn<ExecutionSnapshotFixture, []>().mockReturnValue({
      version: '1.0.0',
      registryEnforced: true,
      agentSpoofingProtection: true,
      correlationPropagation: true,
    }),
  },
  queueMonitor: {
    getStatus: jest
      .fn<Promise<QueueStatusReport>, []>()
      .mockResolvedValue(createQueueReport('HEALTHY')),
  },
});

const createService = (
  mocks: ServiceMocks,
  options: {
    includeOptionalDependencies?: boolean;
    includeQueueMonitor?: boolean;
  } = {},
): AiRuntimeHealthService => {
  const includeOptionalDependencies =
    options.includeOptionalDependencies ?? true;
  const includeQueueMonitor = options.includeQueueMonitor ?? true;

  return new AiRuntimeHealthService(
    mocks.ollama as unknown as OllamaClientService,
    mocks.reranker as unknown as AiRerankerClientService,
    mocks.runtimeCoordinator as unknown as AiRuntimeCoordinatorService,
    includeOptionalDependencies
      ? (mocks.agentRegistry as unknown as AiAgentRegistryService)
      : undefined,
    includeOptionalDependencies
      ? (mocks.circuitBreaker as unknown as AiCircuitBreakerService)
      : undefined,
    includeOptionalDependencies
      ? (mocks.executionContext as unknown as AiExecutionContextService)
      : undefined,
    includeQueueMonitor
      ? (mocks.queueMonitor as unknown as QueueMonitorService)
      : undefined,
  );
};

describe('AiRuntimeHealthService', () => {
  const originalEnv = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const key of MODEL_ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
    }
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-26T12:34:56.000Z'));

    for (const key of MODEL_ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();

    for (const key of MODEL_ENV_KEYS) {
      const value = originalEnv.get(key);

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('reports READY with deduplicated default models and complete healthy foundation', async () => {
    const mocks = createMocks();
    const health = await createService(mocks).getHealth();

    expect(health.status).toBe('READY');
    expect(health.ready).toBe(true);
    expect(health.checkedAt).toBe('2026-07-26T12:34:56.000Z');
    expect(health.requiredModels).toEqual(DEFAULT_REQUIRED_MODELS);
    expect(health.missingModels).toEqual([]);
    expect(health.scheduler).toEqual(
      mocks.runtimeCoordinator.getSnapshot.mock.results[0]?.value,
    );

    expect(health.foundation.agents).toEqual({
      version: '1.0.0',
      totalAgents: 4,
    });
    expect(health.foundation.circuitReady).toBe(true);
    expect(health.foundation.executionGovernanceReady).toBe(true);
    expect(health.foundation.queueExecutionGovernance.ready).toBe(true);
    expect(health.foundation.queueOperationalReady).toBe(true);
    expect(health.foundation.queueOperationalHealth).toMatchObject({
      available: true,
      ready: true,
      level: 'HEALTHY',
      error: null,
    });

    expect(mocks.ollama.health).toHaveBeenCalledTimes(1);
    expect(mocks.reranker.health).toHaveBeenCalledTimes(1);
    expect(mocks.runtimeCoordinator.getSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.queueMonitor.getStatus).toHaveBeenCalledTimes(1);
  });

  it('trims, removes empty values and deduplicates configured models', async () => {
    process.env.AI_OLLAMA_PUBLIC_MODEL = ' public-model ';
    process.env.AI_OLLAMA_CONTENT_MODEL = ' shared-model ';
    process.env.AI_OLLAMA_VISION_MODEL = '   ';
    process.env.AI_OLLAMA_EMBEDDING_MODEL = ' embedding-model ';
    process.env.AI_OLLAMA_FALLBACK_MODEL = 'shared-model';

    const mocks = createMocks();

    mocks.ollama.health.mockResolvedValue({
      ok: true,
      baseUrl: 'http://ollama.test',
      version: '0.11.0',
      models: ['public-model', 'shared-model', 'embedding-model'],
      error: null,
    });

    const health = await createService(mocks).getHealth();

    expect(health.requiredModels).toEqual([
      'public-model',
      'shared-model',
      'embedding-model',
    ]);
    expect(health.missingModels).toEqual([]);
    expect(health.ready).toBe(true);
  });

  it('degrades when one or more required Ollama models are missing', async () => {
    const mocks = createMocks();

    mocks.ollama.health.mockResolvedValue({
      ok: true,
      baseUrl: 'http://ollama.test',
      version: '0.11.0',
      models: ['qwen3.5:9b', 'qwen3:14b'],
      error: null,
    });

    const health = await createService(mocks).getHealth();

    expect(health.status).toBe('DEGRADED');
    expect(health.ready).toBe(false);
    expect(health.missingModels).toEqual(['qwen3-vl:8b', 'qwen3-embedding:4b']);
  });

  it.each([
    {
      title: 'Ollama is unhealthy',
      configure: (mocks: ServiceMocks): void => {
        mocks.ollama.health.mockResolvedValue({
          ok: false,
          baseUrl: 'http://ollama.test',
          version: null,
          models: [],
          error: 'offline',
        });
      },
    },
    {
      title: 'Reranker is unhealthy',
      configure: (mocks: ServiceMocks): void => {
        mocks.reranker.health.mockResolvedValue({
          ok: false,
          enabled: true,
          baseUrl: 'http://reranker.test',
          modelLoaded: false,
          modelName: null,
          modelPath: null,
          error: 'not ready',
        });
      },
    },
  ])('degrades when $title', async ({ configure }) => {
    const mocks = createMocks();

    configure(mocks);

    const health = await createService(mocks).getHealth();

    expect(health.status).toBe('DEGRADED');
    expect(health.ready).toBe(false);
  });

  it.each([
    {
      title: 'an open circuit exists',
      openCircuits: 1,
      halfOpenCircuits: 0,
    },
    {
      title: 'a half-open circuit exists',
      openCircuits: 0,
      halfOpenCircuits: 1,
    },
  ])('degrades when $title', async ({ openCircuits, halfOpenCircuits }) => {
    const mocks = createMocks();

    mocks.circuitBreaker.getSnapshot.mockReturnValue({
      openCircuits,
      halfOpenCircuits,
      closedCircuits: 0,
      totalCircuits: 1,
    });

    const health = await createService(mocks).getHealth();

    expect(health.status).toBe('DEGRADED');
    expect(health.ready).toBe(false);
    expect(health.foundation.circuitReady).toBe(false);
  });

  it.each([
    'registryEnforced',
    'agentSpoofingProtection',
    'correlationPropagation',
  ] as const)(
    'degrades when execution governance disables %s',
    async (property) => {
      const mocks = createMocks();

      mocks.executionContext.getSnapshot.mockReturnValue({
        version: '1.0.0',
        registryEnforced: true,
        agentSpoofingProtection: true,
        correlationPropagation: true,
        [property]: false,
      });

      const health = await createService(mocks).getHealth();

      expect(health.status).toBe('DEGRADED');
      expect(health.ready).toBe(false);
      expect(health.foundation.executionGovernanceReady).toBe(false);
    },
  );

  it('keeps warning-level queue operations ready', async () => {
    const mocks = createMocks();

    mocks.queueMonitor.getStatus.mockResolvedValue(
      createQueueReport('WARNING'),
    );

    const health = await createService(mocks).getHealth();

    expect(health.ready).toBe(true);
    expect(health.status).toBe('READY');
    expect(health.foundation.queueOperationalReady).toBe(true);
    expect(health.foundation.queueOperationalHealth).toMatchObject({
      available: true,
      ready: true,
      level: 'WARNING',
    });
  });

  it('degrades when queue operational health is degraded', async () => {
    const mocks = createMocks();

    mocks.queueMonitor.getStatus.mockResolvedValue(
      createQueueReport('DEGRADED'),
    );

    const health = await createService(mocks).getHealth();

    expect(health.ready).toBe(false);
    expect(health.status).toBe('DEGRADED');
    expect(health.foundation.queueOperationalReady).toBe(false);
    expect(health.foundation.queueOperationalHealth).toMatchObject({
      available: true,
      ready: false,
      level: 'DEGRADED',
    });
  });

  it('maps a queue monitor error to an unavailable degraded snapshot', async () => {
    const mocks = createMocks();

    mocks.queueMonitor.getStatus.mockRejectedValue(
      new Error('  queue monitor offline  '),
    );

    const health = await createService(mocks).getHealth();

    expect(health.ready).toBe(false);
    expect(health.status).toBe('DEGRADED');
    expect(health.foundation.queueOperationalReady).toBe(false);
    expect(health.foundation.queueOperationalHealth).toEqual({
      available: false,
      ready: false,
      level: 'UNAVAILABLE',
      report: null,
      error: 'queue monitor offline',
    });
  });

  it('uses the fallback queue error for a blank non-Error rejection', async () => {
    const mocks = createMocks();

    mocks.queueMonitor.getStatus.mockRejectedValue('   ');

    const health = await createService(mocks).getHealth();

    expect(health.foundation.queueOperationalHealth).toEqual({
      available: false,
      ready: false,
      level: 'UNAVAILABLE',
      report: null,
      error: 'Queue operational health is unavailable.',
    });
  });

  it('treats absent optional governance and queue dependencies as ready', async () => {
    const mocks = createMocks();

    const health = await createService(mocks, {
      includeOptionalDependencies: false,
      includeQueueMonitor: false,
    }).getHealth();

    expect(health.ready).toBe(true);
    expect(health.status).toBe('READY');
    expect(health.foundation.agents).toBeNull();
    expect(health.foundation.circuitBreakers).toBeNull();
    expect(health.foundation.circuitReady).toBe(true);
    expect(health.foundation.executionGovernance).toBeNull();
    expect(health.foundation.executionGovernanceReady).toBe(true);
    expect(health.foundation.queueOperationalHealth).toBeNull();
    expect(health.foundation.queueOperationalReady).toBe(true);
    expect(mocks.queueMonitor.getStatus).not.toHaveBeenCalled();
  });

  it('propagates a direct provider health rejection', async () => {
    const mocks = createMocks();

    mocks.ollama.health.mockRejectedValue(
      new Error('ollama health request failed'),
    );

    await expect(createService(mocks).getHealth()).rejects.toThrow(
      'ollama health request failed',
    );
  });
});
