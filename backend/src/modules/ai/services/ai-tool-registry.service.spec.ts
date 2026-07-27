import { ForbiddenException } from '@nestjs/common';

import {
  AiToolDefinition,
  AiToolRegistryService,
} from './ai-tool-registry.service';

describe('AiToolRegistryService', () => {
  let service: AiToolRegistryService;

  beforeEach(() => {
    service = new AiToolRegistryService();
  });

  it('registers the complete default tool baseline in sorted order', () => {
    const definitions = service.listToolDefinitions();

    const names = definitions.map((tool) => tool.name);

    const sortedNames = [...names].sort((left, right) =>
      left.localeCompare(right),
    );

    expect(definitions).toHaveLength(25);
    expect(names).toEqual(sortedNames);
    expect(service.listTools()).toEqual(names);
    expect(names).toContain('product.registration.assist');
  });

  it('retrieves a default tool using normalized lookup', () => {
    const tool = service.getTool(' PRODUCT.QUALITY.AUDIT ');

    expect(tool).not.toBeNull();

    if (!tool) {
      throw new Error('Expected product quality audit tool.');
    }

    expect(tool).toEqual({
      name: 'product.quality.audit',
      title: 'ارزیابی کیفیت محصول',
      description:
        'بررسی کامل بودن اطلاعات، رسانه، سئو، قیمت‌گذاری امن و داده‌های لازم برای انتشار یا مشاوره فروش محصول.',
      module: 'product',
      riskLevel: 'READ_ONLY',
      executionMode: 'READ',
      requiredPermissions: ['ai:manage', 'products:read', 'catalog:read'],
      requiresApproval: false,
      enabled: true,
    });

    expect(service.isToolEnabled(' PRODUCT.QUALITY.AUDIT ')).toBe(true);
  });

  it('lists only enabled read-only tools that require no approval', () => {
    const publicTools = service.listPublicSafeToolDefinitions();

    expect(publicTools.length).toBeGreaterThan(0);

    expect(
      publicTools.every(
        (tool) =>
          tool.enabled &&
          tool.riskLevel === 'READ_ONLY' &&
          !tool.requiresApproval,
      ),
    ).toBe(true);

    const names = publicTools.map((tool) => tool.name);

    expect(names).toContain('product.read');
    expect(names).toContain('report.store.health');
    expect(names).not.toContain('product.content.draft');
    expect(names).not.toContain('product.content.apply');
    expect(names).not.toContain('coupon.discount.suggest');
  });

  it('registers a string tool with normalized safe defaults', () => {
    service.registerTool(' CUSTOM.REVIEW ');

    const tool = service.getTool('custom.review');

    expect(tool).not.toBeNull();

    if (!tool) {
      throw new Error('Expected custom string tool.');
    }

    expect(tool.name).toBe('custom.review');
    expect(tool.title).toBe('custom.review');
    expect(tool.description.length).toBeGreaterThan(0);
    expect(tool.module).toBe('custom');
    expect(tool.riskLevel).toBe('READ_ONLY');
    expect(tool.executionMode).toBe('READ');
    expect(tool.requiredPermissions).toEqual(['ai:read']);
    expect(tool.requiresApproval).toBe(false);
    expect(tool.enabled).toBe(true);
  });

  it('normalizes object names, modules, and permission lists', () => {
    const definition: AiToolDefinition = {
      name: ' INVENTORY.SYNC ',
      title: 'همگام‌سازی موجودی',
      description: 'آماده‌سازی عملیات موجودی.',
      module: ' INVENTORY ',
      riskLevel: 'SENSITIVE',
      executionMode: 'APPROVAL_REQUIRED',
      requiredPermissions: [
        ' AI:MANAGE ',
        ' inventory:update ',
        'ai:manage',
        '',
      ],
      requiresApproval: true,
      enabled: true,
    };

    service.registerTool(definition);

    expect(service.getTool('inventory.sync')).toEqual({
      ...definition,
      name: 'inventory.sync',
      module: 'inventory',
      requiredPermissions: ['ai:manage', 'inventory:update'],
    });
  });

  it('uses the custom module fallback for an empty module name', () => {
    service.registerTool({
      name: 'custom.empty-module',
      title: 'ابزار سفارشی',
      description: 'ابزار آزمایشی.',
      module: '   ',
      riskLevel: 'DRAFT',
      executionMode: 'DRAFT_ONLY',
      requiredPermissions: [],
      requiresApproval: false,
      enabled: true,
    });

    expect(service.getTool('custom.empty-module')?.module).toBe('custom');
  });

  it('replaces an existing tool registered with the same normalized name', () => {
    service.registerTool({
      name: 'custom.replace',
      title: 'نسخه اول',
      description: 'تعریف اول.',
      module: 'custom',
      riskLevel: 'READ_ONLY',
      executionMode: 'READ',
      requiredPermissions: ['ai:read'],
      requiresApproval: false,
      enabled: true,
    });

    service.registerTool({
      name: ' CUSTOM.REPLACE ',
      title: 'نسخه دوم',
      description: 'تعریف دوم.',
      module: 'operations',
      riskLevel: 'SENSITIVE',
      executionMode: 'APPROVAL_REQUIRED',
      requiredPermissions: ['ai:manage'],
      requiresApproval: true,
      enabled: true,
    });

    const tool = service.getTool('custom.replace');

    expect(tool?.title).toBe('نسخه دوم');
    expect(tool?.module).toBe('operations');
    expect(tool?.riskLevel).toBe('SENSITIVE');
    expect(tool?.requiresApproval).toBe(true);
  });

  it('keeps disabled tools discoverable but rejects their execution', () => {
    service.registerTool({
      name: 'custom.disabled',
      title: 'ابزار غیرفعال',
      description: 'نباید اجرا شود.',
      module: 'custom',
      riskLevel: 'READ_ONLY',
      executionMode: 'READ',
      requiredPermissions: [],
      requiresApproval: false,
      enabled: false,
    });

    expect(service.getTool('custom.disabled')).not.toBeNull();

    expect(service.isToolEnabled('custom.disabled')).toBe(false);

    expect(() => service.assertToolEnabled('custom.disabled')).toThrow(
      ForbiddenException,
    );
  });

  it('returns safe absence results and rejects an unknown tool', () => {
    expect(service.getTool('missing.tool')).toBeNull();

    expect(service.isToolEnabled('missing.tool')).toBe(false);

    expect(() => service.assertToolEnabled('missing.tool')).toThrow(
      ForbiddenException,
    );
  });

  it('accepts a structured tool-call input when asserting availability', () => {
    const tool = service.assertToolEnabled({
      toolName: ' PRODUCT.QUALITY.AUDIT ',
      userId: 'admin-1',
      input: {
        productId: 'product-1',
      },
    });

    expect(tool.name).toBe('product.quality.audit');

    expect(tool.enabled).toBe(true);
  });
});
