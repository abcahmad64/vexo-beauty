import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import type {
  AiAgentDefinition,
  AiAgentResolution,
  AiAgentSnapshotItem,
} from '../interfaces/ai-agent.interface';

import type { AiCanonicalTaskType } from '../interfaces/ai-provider.interface';

@Injectable()
export class AiAgentRegistryService {
  private readonly agents = new Map<string, AiAgentDefinition>();

  private readonly taskOwners = new Map<AiCanonicalTaskType, string>();

  constructor() {
    this.registerBuiltInAgents();
  }

  registerAgent(input: AiAgentDefinition): AiAgentDefinition {
    const definition = this.normalizeDefinition(input);

    if (this.agents.has(definition.id)) {
      throw new ConflictException(
        `عامل هوشمند با شناسه ${definition.id} قبلاً ثبت شده است.`,
      );
    }

    for (const taskType of definition.taskTypes) {
      const existingOwner = this.taskOwners.get(taskType);

      if (existingOwner) {
        throw new ConflictException(
          `وظیفه ${taskType} قبلاً به عامل ${existingOwner} اختصاص یافته است.`,
        );
      }
    }

    this.agents.set(definition.id, definition);

    for (const taskType of definition.taskTypes) {
      this.taskOwners.set(taskType, definition.id);
    }

    return definition;
  }

  resolveForTask(task = 'PUBLIC_CHAT'): AiAgentResolution {
    const normalizedTaskType = this.normalizeTaskType(task);
    const agentId = this.taskOwners.get(normalizedTaskType);

    if (!agentId) {
      throw new NotFoundException(
        `عامل هوشمندی برای وظیفه ${normalizedTaskType} ثبت نشده است.`,
      );
    }

    const agent = this.assertAgentEnabled(agentId);

    return {
      agent,
      normalizedTaskType,
      requestedTask: task,
    };
  }

  assertAgentEnabled(agentId: string): AiAgentDefinition {
    const agent = this.getAgent(agentId);

    if (!agent.enabled) {
      throw new ServiceUnavailableException(
        `عامل هوشمند ${agent.title} در حال حاضر غیرفعال است.`,
      );
    }

    return agent;
  }

  getAgent(agentId: string): AiAgentDefinition {
    const normalizedId = this.normalizeAgentId(agentId);
    const agent = this.agents.get(normalizedId);

    if (!agent) {
      throw new NotFoundException(
        `عامل هوشمند با شناسه ${normalizedId} یافت نشد.`,
      );
    }

    return agent;
  }

  listAgents(): AiAgentSnapshotItem[] {
    return [...this.agents.values()]
      .map((agent) => ({
        ...agent,
        status: agent.enabled ? ('AVAILABLE' as const) : ('DISABLED' as const),
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  getSnapshot() {
    const agents = this.listAgents();

    return {
      totalAgents: agents.length,
      availableAgents: agents.filter((agent) => agent.enabled).length,
      disabledAgents: agents.filter((agent) => !agent.enabled).length,
      coveredTaskTypes: [...this.taskOwners.keys()].sort(),
      agents,
    };
  }

  private registerBuiltInAgents(): void {
    const definitions: AiAgentDefinition[] = [
      {
        id: 'storefront-sales',
        title: 'مشاور فروش و تجربه مشتری',
        description:
          'پاسخ‌گویی عمومی، مشاوره فروش و مقایسه محصول با قابلیت انتقال به انسان.',
        version: '1.0.0',
        enabled: this.readEnabled('AI_AGENT_STOREFRONT_SALES_ENABLED', true),
        executionMode: 'READ_ONLY',
        capabilities: [
          'PUBLIC_ASSISTANT',
          'SALES_CONSULTING',
          'PRODUCT_COMPARISON',
          'HUMAN_HANDOFF',
        ],
        taskTypes: ['PUBLIC_CHAT', 'CONSULTING', 'SALES', 'COMPARISON'],
        modelRequirements: {
          provider: 'ollama',
          taskTypes: ['PUBLIC_CHAT', 'CONSULTING', 'SALES', 'COMPARISON'],
          supportsFallback: true,
          requiresEmbedding: false,
          requiresVision: false,
        },
        supportsHumanHandoff: true,
      },
      {
        id: 'product-intelligence',
        title: 'پژوهش و محتوای محصول',
        description:
          'پژوهش کنترل‌شده، تولید محتوای پیشنهادی و سئوی محصول بدون اعمال مستقیم.',
        version: '1.0.0',
        enabled: this.readEnabled(
          'AI_AGENT_PRODUCT_INTELLIGENCE_ENABLED',
          true,
        ),
        executionMode: 'SUGGEST_ONLY',
        capabilities: ['PRODUCT_RESEARCH', 'CONTENT_DRAFTING', 'SEO_DRAFTING'],
        taskTypes: ['CONTENT', 'SEO'],
        modelRequirements: {
          provider: 'ollama',
          taskTypes: ['CONTENT', 'SEO'],
          supportsFallback: true,
          requiresEmbedding: false,
          requiresVision: false,
        },
        supportsHumanHandoff: false,
      },
      {
        id: 'recommendation-engine',
        title: 'موتور پیشنهاد محصول',
        description:
          'تولید پیشنهادهای قابل توضیح بر اساس کاتالوگ و موجودی واقعی.',
        version: '1.0.0',
        enabled: this.readEnabled('AI_AGENT_RECOMMENDATION_ENABLED', true),
        executionMode: 'READ_ONLY',
        capabilities: ['PRODUCT_RECOMMENDATION'],
        taskTypes: ['RECOMMENDATION'],
        modelRequirements: {
          provider: 'ollama',
          taskTypes: ['RECOMMENDATION'],
          supportsFallback: true,
          requiresEmbedding: false,
          requiresVision: false,
        },
        supportsHumanHandoff: false,
      },
      {
        id: 'marketing-strategist',
        title: 'بازاریاب هوشمند',
        description:
          'تحلیل تقاضا و تولید پیشنهاد کمپین، تخفیف و پیام بدون اجرای خودکار عملیات حساس.',
        version: '1.0.0',
        enabled: this.readEnabled('AI_AGENT_MARKETING_ENABLED', true),
        executionMode: 'SUGGEST_ONLY',
        capabilities: [
          'MARKETING_STRATEGY',
          'DISCOUNT_SUGGESTION',
          'MESSAGE_DRAFTING',
          'DEMAND_ANALYSIS',
        ],
        taskTypes: [
          'SMS',
          'BANNER_TEXT',
          'MARKETING_STRATEGY',
          'DISCOUNT',
          'DEMAND_ANALYSIS',
        ],
        modelRequirements: {
          provider: 'ollama',
          taskTypes: [
            'SMS',
            'BANNER_TEXT',
            'MARKETING_STRATEGY',
            'DISCOUNT',
            'DEMAND_ANALYSIS',
          ],
          supportsFallback: true,
          requiresEmbedding: false,
          requiresVision: false,
        },
        supportsHumanHandoff: false,
      },
      {
        id: 'business-copilot',
        title: 'دستیار مدیریتی',
        description:
          'تحلیل خواندنی کسب‌وکار و تولید گزارش مدیریتی مبتنی بر داده واقعی.',
        version: '1.0.0',
        enabled: this.readEnabled('AI_AGENT_BUSINESS_COPILOT_ENABLED', true),
        executionMode: 'READ_ONLY',
        capabilities: ['BUSINESS_ANALYTICS', 'ADMIN_REPORTING'],
        taskTypes: ['ANALYTICS', 'ADMIN_REPORT'],
        modelRequirements: {
          provider: 'ollama',
          taskTypes: ['ANALYTICS', 'ADMIN_REPORT'],
          supportsFallback: true,
          requiresEmbedding: false,
          requiresVision: false,
        },
        supportsHumanHandoff: false,
      },
      {
        id: 'media-vision',
        title: 'هوش رسانه و تصویر',
        description: 'تحلیل تصویر، تولید توضیح و alt text به‌صورت پیشنهادی.',
        version: '1.0.0',
        enabled: this.readEnabled('AI_AGENT_MEDIA_VISION_ENABLED', true),
        executionMode: 'SUGGEST_ONLY',
        capabilities: [
          'VISION_ANALYSIS',
          'ALT_TEXT_DRAFTING',
          'IMAGE_DESCRIPTION',
        ],
        taskTypes: ['VISION', 'ALT_TEXT', 'IMAGE_DESCRIPTION'],
        modelRequirements: {
          provider: 'ollama',
          taskTypes: ['VISION', 'ALT_TEXT', 'IMAGE_DESCRIPTION'],
          supportsFallback: true,
          requiresEmbedding: false,
          requiresVision: true,
        },
        supportsHumanHandoff: false,
      },
      {
        id: 'semantic-retrieval',
        title: 'بازیابی معنایی',
        description: 'تولید embedding برای جست‌وجوی معنایی و بازیابی ترکیبی.',
        version: '1.0.0',
        enabled: this.readEnabled('AI_AGENT_SEMANTIC_RETRIEVAL_ENABLED', true),
        executionMode: 'READ_ONLY',
        capabilities: ['SEMANTIC_EMBEDDING'],
        taskTypes: ['EMBEDDING'],
        modelRequirements: {
          provider: 'ollama',
          taskTypes: ['EMBEDDING'],
          supportsFallback: false,
          requiresEmbedding: true,
          requiresVision: false,
        },
        supportsHumanHandoff: false,
      },
      {
        id: 'fallback-responder',
        title: 'پاسخ‌گوی جایگزین',
        description: 'مسیر کنترل‌شده جایگزین هنگام عدم دسترسی مدل اصلی.',
        version: '1.0.0',
        enabled: this.readEnabled('AI_AGENT_FALLBACK_ENABLED', true),
        executionMode: 'READ_ONLY',
        capabilities: ['FALLBACK_RESPONSE'],
        taskTypes: ['FALLBACK'],
        modelRequirements: {
          provider: 'ollama',
          taskTypes: ['FALLBACK'],
          supportsFallback: false,
          requiresEmbedding: false,
          requiresVision: false,
        },
        supportsHumanHandoff: false,
      },
    ];

    for (const definition of definitions) {
      this.registerAgent(definition);
    }
  }

  private normalizeDefinition(input: AiAgentDefinition): AiAgentDefinition {
    const id = this.normalizeAgentId(input.id);
    const title = input.title.trim();
    const description = input.description.trim();
    const version = input.version.trim();

    if (!title || !description || !version) {
      throw new ConflictException(
        'تعریف عامل هوشمند باید عنوان، توضیح و نسخه معتبر داشته باشد.',
      );
    }

    const taskTypes = [...new Set(input.taskTypes)];

    if (taskTypes.length === 0) {
      throw new ConflictException(
        `عامل هوشمند ${id} باید حداقل یک نوع وظیفه داشته باشد.`,
      );
    }

    const capabilities = [...new Set(input.capabilities)];

    if (capabilities.length === 0) {
      throw new ConflictException(
        `عامل هوشمند ${id} باید حداقل یک قابلیت اعلام کند.`,
      );
    }

    const requirementTasks = [...new Set(input.modelRequirements.taskTypes)];

    if (
      requirementTasks.length !== taskTypes.length ||
      taskTypes.some((taskType) => !requirementTasks.includes(taskType))
    ) {
      throw new ConflictException(
        `نیازمندی مدل عامل ${id} باید تمام وظایف همان عامل را پوشش دهد.`,
      );
    }

    return {
      ...input,
      id,
      title,
      description,
      version,
      capabilities,
      taskTypes,
      modelRequirements: {
        ...input.modelRequirements,
        taskTypes: requirementTasks,
      },
    };
  }

  private normalizeAgentId(value: string): string {
    const normalized = String(value).trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9.-]{2,79}$/.test(normalized)) {
      throw new ConflictException(
        'شناسه عامل هوشمند باید بین ۳ تا ۸۰ نویسه و شامل حروف کوچک، عدد، نقطه یا خط تیره باشد.',
      );
    }

    return normalized;
  }

  private normalizeTaskType(task: string): AiCanonicalTaskType {
    const normalized = String(task).trim().toUpperCase();

    const legacyMap: Record<string, AiCanonicalTaskType> = {
      CORE: 'PUBLIC_CHAT',
      PUBLIC: 'PUBLIC_CHAT',
      PUBLIC_CHAT: 'PUBLIC_CHAT',
      CHAT: 'PUBLIC_CHAT',
      SALES: 'SALES',
      CONSULTING: 'CONSULTING',
      COMPARISON: 'COMPARISON',
      COMPARE: 'COMPARISON',
      CONTENT: 'CONTENT',
      ARTICLE: 'CONTENT',
      SEO: 'SEO',
      SMS: 'SMS',
      BANNER_TEXT: 'BANNER_TEXT',
      RECOMMENDATION: 'RECOMMENDATION',
      MARKETING: 'MARKETING_STRATEGY',
      MARKETING_STRATEGY: 'MARKETING_STRATEGY',
      ANALYTICS: 'ANALYTICS',
      DISCOUNT: 'DISCOUNT',
      ADMIN_REPORT: 'ADMIN_REPORT',
      DEMAND_ANALYSIS: 'DEMAND_ANALYSIS',
      EMBEDDING: 'EMBEDDING',
      VISION: 'VISION',
      ALT_TEXT: 'ALT_TEXT',
      IMAGE_DESCRIPTION: 'IMAGE_DESCRIPTION',
      FALLBACK: 'FALLBACK',
    };

    return legacyMap[normalized] ?? 'PUBLIC_CHAT';
  }

  private readEnabled(key: string, fallback: boolean): boolean {
    const raw = process.env[key];

    if (raw === undefined) {
      return fallback;
    }

    return !['false', '0', 'no', 'off'].includes(raw.trim().toLowerCase());
  }
}
