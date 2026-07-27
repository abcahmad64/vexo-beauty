export function normalizePersianText(value?: string | null): string {
  if (!value) {
    return '';
  }

  return value
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/ۀ/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/إ|أ|آ/g, 'ا')
    .replace(/‌+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

export function buildPersianLikePattern(value?: string | null): string {
  const normalized = normalizePersianText(value);

  return `%${normalized}%`;
}
