import * as Sentry from '@sentry/nextjs';

/**
 * Masks a phone number for logging (e.g., 254712345678 -> 2547******78)
 */
function maskPhone(phone?: string | null): string {
  if (!phone) return 'N/A';
  // Keep first 4 (country code + network prefix) and last 2, mask the rest
  if (phone.length >= 10) {
    return phone.substring(0, 4) + '*'.repeat(phone.length - 6) + phone.substring(phone.length - 2);
  }
  return '*'.repeat(phone.length);
}

/**
 * Pre-processes arguments before logging to mask sensitive PII
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function maskArgs(args: any[]): any[] {
  return args.map((arg) => {
    if (typeof arg === 'string') {
      // Regex to find things that look like Kenyan phone numbers (2547... or 2541...)
      return arg.replace(/254[17]\d{8}/g, (match) => maskPhone(match));
    }
    if (typeof arg === 'object' && arg !== null) {
      const cloned = { ...arg };
      if ('phone' in cloned && typeof cloned.phone === 'string') {
        cloned.phone = maskPhone(cloned.phone);
      }
      return cloned;
    }
    return arg;
  });
}

export const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (message: string, ...args: any[]) => {
    const maskedArgs = maskArgs(args);
    console.info(message, ...maskedArgs);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (message: string, ...args: any[]) => {
    const maskedArgs = maskArgs(args);
    console.warn(message, ...maskedArgs);
    Sentry.captureMessage(message, 'warning');
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (message: string, error?: unknown, ...args: any[]) => {
    const maskedArgs = maskArgs(args);
    console.error(message, error, ...maskedArgs);
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: { message, args: maskedArgs } });
    } else {
      Sentry.captureMessage(message, 'error');
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      const maskedArgs = maskArgs(args);
      console.debug(message, ...maskedArgs);
    }
  },
};
