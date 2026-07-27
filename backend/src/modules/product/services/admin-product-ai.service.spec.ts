import { BadRequestException } from '@nestjs/common';

import { AiPermissionGuardService } from '../../ai/services/ai-permission-guard.service';
import { AiService } from '../../ai/services/ai.service';
import { AiToolRegistryService } from '../../ai/services/ai-tool-registry.service';

import { AdminProductAiService } from './admin-product-ai.service';
import { AdminProductSeoService } from './admin-product-seo.service';
import { AdminProductService } from './admin-product.service';

describe('AdminProductAiService', () => {
  let findOne: jest.Mock;
  let update: jest.Mock;
  let service: AdminProductAiService;

  beforeEach(() => {
    findOne = jest.fn();
    update = jest.fn();

    service = new AdminProductAiService(
      {
        findOne,
        update,
      } as unknown as AdminProductService,
      {} as unknown as AdminProductSeoService,
      {} as unknown as AiService,
      {
        assertToolEnabled: jest.fn().mockReturnValue({
          name: 'product.quality.audit',
          title: 'ارزیابی کیفیت محصول',
          description: 'Read-only product quality audit.',
          module: 'product',
          riskLevel: 'READ_ONLY',
          executionMode: 'READ',
          requiredPermissions: ['ai:manage', 'products:read', 'catalog:read'],
          requiresApproval: false,
          enabled: true,
        }),
      } as unknown as AiToolRegistryService,
      {
        assertAuthenticated: jest.fn(),
        assertAllowed: jest.fn(),
        assertApprovalAllowed: jest.fn(),
      } as unknown as AiPermissionGuardService,
    );
  });

  it('rejects mutation requests for the read-only quality audit tool', async () => {
    await expect(
      service.auditProductQuality(
        'product-1',
        {
          applyToProduct: true,
        },
        {
          userId: 'admin-1',
          role: 'SUPER_ADMIN',
        },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(findOne).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
