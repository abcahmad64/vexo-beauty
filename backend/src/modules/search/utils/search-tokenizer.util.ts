import { normalizePersianText } from './persian-normalizer.util';

const STOP_WORDS = new Set([
  'از',
  'به',
  'با',
  'در',
  'برای',
  'و',
  'یا',
  'یک',
  'این',
  'آن',
  'را',
  'های',
]);

export function tokenizeSearchQuery(query?: string | null): string[] {
  const normalized = normalizePersianText(query);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !STOP_WORDS.has(token));
}
