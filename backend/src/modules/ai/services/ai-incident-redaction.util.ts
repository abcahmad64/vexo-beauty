const SECRET =
  /(authorization|cookie|password|secret|token|api[-_]?key|private[-_]?key|client[-_]?secret)/i;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export class AiIncidentRedactionUtil {
  static text(value?: string | null): string | null {
    return value == null
      ? null
      : value
          .replace(BEARER, 'Bearer [REDACTED]')
          .replace(EMAIL, '[REDACTED_EMAIL]');
  }
  static object(
    input?: Record<string, unknown> | null,
    depth = 0,
  ): Record<string, unknown> | null {
    if (!input) return null;
    if (depth > 8) return { truncated: true };
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        SECRET.test(key) ? '[REDACTED]' : this.value(value, depth + 1),
      ]),
    );
  }
  private static value(value: unknown, depth: number): unknown {
    if (typeof value === 'string') return this.text(value);
    if (Array.isArray(value))
      return value.slice(0, 100).map((item) => this.value(item, depth + 1));
    if (value && typeof value === 'object')
      return this.object(value as Record<string, unknown>, depth + 1);
    return value;
  }
}
