export function safeJson<T = unknown>(value: unknown): T | undefined {
  try {
    const normalized = normalizeJsonValue(value, new WeakSet<object>());

    if (normalized === undefined) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(normalized)) as T;
  } catch {
    return undefined;
  }
}

function normalizeJsonValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return '[FUNCTION]';
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeJsonValue(item, seen))
      .filter((item) => item !== undefined);
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[CIRCULAR]';
    }

    seen.add(value);

    const output: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      const normalizedItem = normalizeJsonValue(item, seen);

      if (normalizedItem !== undefined) {
        output[key] = normalizedItem;
      }
    }

    seen.delete(value);

    return output;
  }

  return value;
}
