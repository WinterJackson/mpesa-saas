import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from './logger';
import * as Sentry from '@sentry/nextjs';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

describe('logger', () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  it('masks phone numbers in info logs (when passed as args)', () => {
    logger.info('User initiated payment', { phone: '254712345678' });
    expect(consoleInfoSpy).toHaveBeenCalledWith('User initiated payment', expect.objectContaining({ phone: '2547******78' }));
  });

  it('masks phone numbers in debug logs (when passed as args)', () => {
    logger.debug('Params:', '254712345678');
    expect(consoleDebugSpy).toHaveBeenCalledWith('Params:', expect.stringContaining('2547******78'));
  });

  it('captures exceptions to Sentry on error', () => {
    const error = new Error('Test error');
    logger.error('Something went wrong', error);
    
    expect(consoleErrorSpy).toHaveBeenCalledWith('Something went wrong', error);
    expect(Sentry.captureException).toHaveBeenCalledWith(error, expect.objectContaining({
      extra: expect.objectContaining({ message: 'Something went wrong' })
    }));
  });
});
