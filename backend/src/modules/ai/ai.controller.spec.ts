import { BadRequestException } from '@nestjs/common';

import { AiController } from './ai.controller';
import { AiProductContentMode } from './dto/ai-product-content.dto';
import { AiRuntimeHealthService } from './services/ai-runtime-health.service';
import { AiService } from './services/ai.service';

describe('AiController', () => {
  let generateProductContent: jest.Mock;
  let controller: AiController;

  const request = {
    user: {
      id: 'admin-1',
      role: 'SUPER_ADMIN',
    },
  } as never;

  beforeEach(() => {
    generateProductContent = jest.fn();

    controller = new AiController(
      {
        generateProductContent,
      } as unknown as AiService,
      {} as unknown as AiRuntimeHealthService,
    );
  });

  it('rejects direct product mutation through the legacy content route', () => {
    expect(() =>
      controller.generateProductContent(request, {
        productId: 'product-1',
        mode: AiProductContentMode.FULL,
        applyToProduct: true,
      }),
    ).toThrow(BadRequestException);

    expect(generateProductContent).not.toHaveBeenCalled();
  });

  it('forces accepted legacy requests into draft-only mode', async () => {
    generateProductContent.mockResolvedValue({
      productId: 'product-1',
      applied: null,
    });

    await expect(
      controller.generateProductContent(request, {
        productId: 'product-1',
        mode: AiProductContentMode.DESCRIPTION,
      }),
    ).resolves.toEqual({
      productId: 'product-1',
      applied: null,
    });

    expect(generateProductContent).toHaveBeenCalledWith(
      {
        productId: 'product-1',
        mode: AiProductContentMode.DESCRIPTION,
        applyToProduct: false,
      },
      'admin-1',
    );
  });
});
