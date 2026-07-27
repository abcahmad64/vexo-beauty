export type PersianDateInput = Date | string | number | null | undefined;

const DEFAULT_PERSIAN_LOCALE = 'fa-IR-u-ca-persian';

const DEFAULT_TIME_ZONE = 'Asia/Tehran';

function resolveDate(value: PersianDateInput): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatWithOptions(
  value: PersianDateInput,
  options: Intl.DateTimeFormatOptions,
): string | null {
  const date = resolveDate(value);

  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(DEFAULT_PERSIAN_LOCALE, {
    timeZone: DEFAULT_TIME_ZONE,
    ...options,
  }).format(date);
}

export function formatPersianDateTime(value: PersianDateInput): string | null {
  return formatWithOptions(value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatPersianDate(value: PersianDateInput): string | null {
  return formatWithOptions(value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatPersianTime(value: PersianDateInput): string | null {
  return formatWithOptions(value, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
