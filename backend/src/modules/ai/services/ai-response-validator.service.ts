import { BadRequestException, Injectable } from '@nestjs/common';

import { AiCanonicalTaskType } from '../interfaces/ai-provider.interface';

@Injectable()
export class AiResponseValidatorService {
  validateAndNormalize(input: {
    content: string;
    json?: boolean;
    taskType: AiCanonicalTaskType;
  }): string {
    const withoutThinking = this.removeThinkingBlocks(input.content);

    const content = withoutThinking.trim();

    if (!content) {
      throw new BadRequestException('خروجی هوش مصنوعی خالی است.');
    }

    if (content.length > 120000) {
      throw new BadRequestException(
        'خروجی هوش مصنوعی بیش از حد مجاز طولانی است.',
      );
    }

    if (input.json === true) {
      return this.normalizeJsonResponse(content);
    }

    const normalized = this.normalizePlainTextResponse(content, input.taskType);

    if (!normalized) {
      throw new BadRequestException(
        'خروجی هوش مصنوعی پس از پاک‌سازی خالی است.',
      );
    }

    return normalized;
  }

  private removeThinkingBlocks(content: string): string {
    let cleaned = content
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/```thinking[\s\S]*?```/gi, '')
      .replace(/```analysis[\s\S]*?```/gi, '')
      .replace(/```reasoning[\s\S]*?```/gi, '')
      .trim();

    cleaned = this.removeOllamaThinkingPrefix(cleaned);

    return cleaned.trim();
  }

  private removeOllamaThinkingPrefix(content: string): string {
    const doneThinkingMarkers = [
      '...done thinking.',
      'done thinking.',
      'final answer:',
      'final:',
      'answer:',
      'پاسخ نهایی:',
      'پایان تحلیل',
      'پایان فکر',
    ];

    const lower = content.toLowerCase();

    for (const marker of doneThinkingMarkers) {
      const index = lower.lastIndexOf(marker.toLowerCase());

      if (index >= 0) {
        return content.slice(index + marker.length).trim();
      }
    }

    const thinkingPatterns = [
      /^thinking\.\.\.[\s\S]*?(?=\n\s*[^\n]*[\u0600-\u06FF])/i,
      /^thinking process:[\s\S]*?(?=\n\s*[^\n]*[\u0600-\u06FF])/i,
      /^analysis:[\s\S]*?(?=\n\s*[^\n]*[\u0600-\u06FF])/i,
      /^reasoning:[\s\S]*?(?=\n\s*[^\n]*[\u0600-\u06FF])/i,
    ];

    for (const pattern of thinkingPatterns) {
      const cleaned = content.replace(pattern, '').trim();

      if (cleaned !== content.trim()) {
        return cleaned;
      }
    }

    return content;
  }

  private normalizePlainTextResponse(
    content: string,
    taskType: AiCanonicalTaskType,
  ): string {
    let cleaned = content
      .replace(/^پاسخ\s*[:：]\s*/i, '')
      .replace(/^پاسخ نهایی\s*[:：]\s*/i, '')
      .replace(/^Answer\s*[:：]\s*/i, '')
      .replace(/^Final answer\s*[:：]\s*/i, '')
      .trim();

    if (this.shouldNormalizeForCustomerDisplay(taskType)) {
      cleaned = this.removeInternalHeadings(cleaned);

      cleaned = this.normalizeCustomerMarkdown(cleaned);
    }

    return this.normalizeWhitespace(cleaned);
  }

  private shouldNormalizeForCustomerDisplay(
    taskType: AiCanonicalTaskType,
  ): boolean {
    return [
      'PUBLIC_CHAT',
      'SALES',
      'CONSULTING',
      'RECOMMENDATION',
      'COMPARISON',
      'FALLBACK',
    ].includes(taskType);
  }

  private normalizeCustomerMarkdown(content: string): string {
    return content
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^\s*[*•]\s+/gm, '- ')
      .replace(/^\s*[-–—]\s+/gm, '- ')
      .replace(/^\s*\d+[.)]\s+/gm, '- ')
      .replace(/\[([^\]]+)]\(([^)]+)\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .trim();
  }

  private removeInternalHeadings(content: string): string {
    return content
      .split('\n')
      .filter((line) => {
        const normalized = line.trim();

        if (!normalized) {
          return true;
        }

        const forbiddenHeadings = [
          'مرحله اول:',
          'مرحله دوم:',
          'مرحله سوم:',
          'مرحله چهارم:',
          'تحلیل نیاز مشتری',
          'تحلیل درخواست مشتری',
          'تردید خرید',
          'پیشنهاد عملی:',
          'وظیفه:',
          'درخواست مشتری:',
          'قالب پاسخ:',
          'خروجی:',
          'پاسخ:',
          'پاسخ نهایی:',
          'thinking',
          'thinking process',
          'analysis',
          'reasoning',
        ];

        return !forbiddenHeadings.some((heading) =>
          normalized.toLowerCase().startsWith(heading.toLowerCase()),
        );
      })
      .join('\n')
      .trim();
  }

  private normalizeWhitespace(content: string): string {
    return content
      .split('\n')
      .map((line) => line.replace(/[ \t]{2,}/g, ' ').trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private normalizeJsonResponse(content: string): string {
    const cleaned = content
      .trim()
      .replace(/^```json/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim();

    const direct = this.tryParseObject(cleaned);

    if (direct) {
      return JSON.stringify(direct);
    }

    const extracted = this.extractFirstJsonObject(cleaned);

    if (extracted) {
      const parsed = this.tryParseObject(extracted);

      if (parsed) {
        return JSON.stringify(parsed);
      }
    }

    throw new BadRequestException(
      'خروجی هوش مصنوعی باید JSON معتبر باشد، اما ساختار معتبر دریافت نشد.',
    );
  }

  private tryParseObject(value: string): Record<string, unknown> | null {
    try {
      const parsed: unknown = JSON.parse(value);

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }

      return null;
    } catch {
      return null;
    }
  }

  private extractFirstJsonObject(value: string): string | null {
    const start = value.indexOf('{');

    const end = value.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    return value.slice(start, end + 1);
  }
}
