export interface TransformInput {
  readonly value: unknown;
}

export function trimString({ value }: TransformInput): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
}

export function trimOptionalString({ value }: TransformInput): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function toOptionalBoolean({ value }: TransformInput): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }

    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = normalizePersianArabicDigits(value)
    .trim()
    .toLowerCase();

  if (normalizedValue.length === 0) {
    return undefined;
  }

  if (
    ['true', '1', 'yes', 'on', 'بله', 'بلی', 'درست', 'فعال'].includes(
      normalizedValue,
    )
  ) {
    return true;
  }

  if (
    ['false', '0', 'no', 'off', 'خیر', 'نه', 'نادرست', 'غیرفعال'].includes(
      normalizedValue,
    )
  ) {
    return false;
  }

  return value;
}

export function toOptionalNumber({ value }: TransformInput): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = normalizeNumericString(value);

  if (normalizedValue.length === 0) {
    return undefined;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : value;
}

export function toOptionalInteger({ value }: TransformInput): unknown {
  const parsedValue = toOptionalNumber({ value });

  if (typeof parsedValue !== 'number') {
    return parsedValue;
  }

  return Math.trunc(parsedValue);
}

export function normalizePersianArabicDigits(value: string): string {
  return value
    .replace(/[۰-۹]/gu, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/gu, (digit) => String(digit.charCodeAt(0) - 1632));
}

function normalizeNumericString(value: string): string {
  return normalizePersianArabicDigits(value)
    .trim()
    .replace(/[,٬\s]/gu, '')
    .replace(/٫/gu, '.');
}
