import { BadRequestException } from '@nestjs/common';

import { AiResponseValidatorService } from './ai-response-validator.service';

describe('AiResponseValidatorService', () => {
  let service: AiResponseValidatorService;

  beforeEach(() => {
    service = new AiResponseValidatorService();
  });

  describe('validateAndNormalize', () => {
    it('removes thinking content and normalizes customer-facing text', () => {
      const result = service.validateAndNormalize({
        content: [
          '<think>internal reasoning</think>',
          'پاسخ نهایی: **محصول مناسب**',
          'تحلیل نیاز مشتری',
          '1. گزینه اول',
          '• گزینه دوم',
          '[جزئیات](https://example.com)',
        ].join('\n'),
        taskType: 'PUBLIC_CHAT',
      });

      expect(result).toBe(
        ['محصول مناسب', '- گزینه اول', '- گزینه دوم', 'جزئیات'].join('\n'),
      );
    });

    it('keeps only the final response after an Ollama thinking marker', () => {
      const result = service.validateAndNormalize({
        content: [
          'thinking process:',
          'internal analysis',
          'done thinking.',
          'پاسخ قابل نمایش',
        ].join('\n'),
        taskType: 'SALES',
      });

      expect(result).toBe('پاسخ قابل نمایش');
    });

    it('preserves markdown for non-customer task types', () => {
      const content = '**عنوان داخلی**\n# بخش تخصصی';

      const result = service.validateAndNormalize({
        content: `Answer: ${content}`,
        taskType: 'CONTENT',
      });

      expect(result).toBe(content);
    });

    it('normalizes a fenced JSON object', () => {
      const result = service.validateAndNormalize({
        content: ['```json', '{"success":true,"items":[1,2]}', '```'].join(
          '\n',
        ),
        json: true,
        taskType: 'ANALYTICS',
      });

      expect(result).toBe('{"success":true,"items":[1,2]}');
    });

    it('extracts the first JSON object from surrounding text', () => {
      const result = service.validateAndNormalize({
        content: 'متن قبل از JSON {"success":true,"count":2} متن بعد از JSON',
        json: true,
        taskType: 'ADMIN_REPORT',
      });

      expect(result).toBe('{"success":true,"count":2}');
    });

    it('rejects JSON values that are not objects', () => {
      const validate = () =>
        service.validateAndNormalize({
          content: '[1,2,3]',
          json: true,
          taskType: 'ANALYTICS',
        });

      expect(validate).toThrow(BadRequestException);
      expect(validate).toThrow(
        'خروجی هوش مصنوعی باید JSON معتبر باشد، اما ساختار معتبر دریافت نشد.',
      );
    });

    it('rejects output that is empty after thinking removal', () => {
      const validate = () =>
        service.validateAndNormalize({
          content: '<think>only internal reasoning</think>',
          taskType: 'PUBLIC_CHAT',
        });

      expect(validate).toThrow(BadRequestException);
      expect(validate).toThrow('خروجی هوش مصنوعی خالی است.');
    });

    it('rejects output longer than the configured limit', () => {
      const validate = () =>
        service.validateAndNormalize({
          content: 'a'.repeat(120001),
          taskType: 'CONTENT',
        });

      expect(validate).toThrow(BadRequestException);
      expect(validate).toThrow('خروجی هوش مصنوعی بیش از حد مجاز طولانی است.');
    });
  });
});
