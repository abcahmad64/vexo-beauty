import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Admin AI provider cost accounting contract', () => {
  const root = resolve(__dirname, '../../..');
  const read = (relative: string) =>
    readFileSync(resolve(root, relative), 'utf8');

  it('exposes one admin-authorized read-only provider cost report endpoint', () => {
    const controller = read('modules/admin/admin.controller.ts');
    const report = read(
      'modules/ai/services/ai-provider-cost-report.service.ts',
    );

    expect(controller).toContain("@Get('ai/provider-costs')");
    expect(controller).toContain('this.assertAdminAiCostReader(req)');
    expect(controller).toContain('this.aiProviderCostReport.getReport(query)');
    expect(report).toContain('readOnly: true');
    expect(report).toContain('PROVIDER_TOKEN_FEE_ONLY');
    expect(report).toContain('this.prisma.aiRunLog.findMany');
    expect(report).not.toMatch(/\.(create|update|upsert|delete)\s*\(/u);
  });

  it('keeps provider pricing versioned and does not add budget enforcement', () => {
    const types = read(
      'modules/ai/interfaces/ai-provider-cost-accounting.interface.ts',
    );
    const pricing = read('modules/ai/services/ai-provider-pricing-catalog.ts');
    const accounting = read(
      'modules/ai/services/ai-provider-cost-accounting.util.ts',
    );

    expect(types).toContain('AI_PROVIDER_COST_ACCOUNTING_VERSION');
    expect(types).toContain('AI_PROVIDER_PRICING_CATALOG_VERSION');
    expect(pricing).toContain('effectiveAt');
    expect(pricing).toContain('PROVIDER_TOKEN_FEE_ONLY');
    expect(accounting).toContain('aggregateCostMicros');
    expect(accounting).toContain('fallbackUsed');
    expect(accounting).toContain('cancelledAttemptCount');
    expect(`${types}\n${pricing}\n${accounting}`).not.toMatch(
      /budgetLimit|maxSpend|reject.*budget|block.*budget/iu,
    );
  });
});
