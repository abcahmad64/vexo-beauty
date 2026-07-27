import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';

import { validate } from 'class-validator';

import { PublicAiChatDto } from './public-ai-assistant.dto';

describe('PublicAiChatDto', () => {
  it('normalizes the global-assistant context fields', async () => {
    const dto = plainToInstance(PublicAiChatDto, {
      message: '  راهنمای خرید می‌خواهم  ',
      pagePath: '  /products/hydrating-serum  ',
      productIdentifier: '  hydrating-serum  ',
      conversationContext: '  کاربر: پوست خشکی دارم.  ',
      limit: '4',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);

    expect(dto).toMatchObject({
      message: 'راهنمای خرید می‌خواهم',
      pagePath: '/products/hydrating-serum',
      productIdentifier: 'hydrating-serum',
      conversationContext: 'کاربر: پوست خشکی دارم.',
      limit: 4,
    });
  });

  it('rejects oversized public context fields', async () => {
    const dto = plainToInstance(PublicAiChatDto, {
      message: 'راهنمای خرید می‌خواهم',
      pagePath: `/${'a'.repeat(241)}`,
      productIdentifier: 'b'.repeat(181),
      conversationContext: 'c'.repeat(3001),
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'pagePath',
        'productIdentifier',
        'conversationContext',
      ]),
    );
  });

  it('keeps the original public prompt requirement in the service layer', async () => {
    const dto = plainToInstance(PublicAiChatDto, {
      pagePath: '/products',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);

    expect(dto.message).toBeUndefined();
    expect(dto.question).toBeUndefined();
  });
});
