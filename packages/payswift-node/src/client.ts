import crypto from 'node:crypto';
import type {
  PaymentInitiateRequest,
  PaymentInitiateData,
  PaymentStatusData,
  PayoutCreateRequest,
  PayoutCreateData,
  RefundCreateRequest,
  RefundCreateData,
  TransactionListData,
  C2bRegisterUrlsData,
  SuccessResponse,
} from './types';

export class PaySwiftError extends Error {
  public status?: number;
  public details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'PaySwiftError';
    this.status = status;
    this.details = details;
  }
}

export interface RequestOptions {
  idempotencyKey?: string;
  maxRetries?: number;
}

export class PaySwiftClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    if (!apiKey) {
      throw new PaySwiftError('apiKey is required');
    }
    if (!baseUrl) {
      throw new PaySwiftError('baseUrl is required — no default production API URL is configured yet');
    }
    this.apiKey = apiKey;
    // Strip trailing slash
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<SuccessResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    } else if (method === 'POST') {
      headers['Idempotency-Key'] = crypto.randomUUID();
    }

    const maxRetries = options?.maxRetries ?? 3;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (response.status >= 500 && response.status < 600) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data = (await response.json()) as Record<string, unknown>;

        if (!response.ok || !data.success) {
          // 4xx errors are thrown immediately without retrying
          throw new PaySwiftError((data.error as string) || `HTTP ${response.status}`, response.status, data);
        }

        return data as SuccessResponse<T>;
      } catch (error: unknown) {
        if (error instanceof PaySwiftError) {
          throw error;
        }
        
        if (attempt >= maxRetries) {
          const errMsg = error instanceof Error ? error.message : String(error);
          throw new PaySwiftError(
            `Request failed after ${maxRetries} retries: ${errMsg}`,
            undefined,
            error
          );
        }
        
        attempt++;
        // Exponential backoff: 500ms, 1000ms, 2000ms...
        const backoffMs = 500 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw new PaySwiftError('Unexpected failure');
  }

  public payments = {
    initiate: (params: PaymentInitiateRequest, options?: RequestOptions) => {
      return this.request<PaymentInitiateData>('POST', '/api/v1/payments/initiate', params, options);
    },
    status: (id: string) => {
      return this.request<PaymentStatusData>('GET', `/api/v1/payments/status/${encodeURIComponent(id)}`);
    },
  };

  public transactions = {
    list: (params?: { cursor?: string; limit?: number; status?: string; environment?: 'sandbox' | 'live' }) => {
      let path = '/api/v1/transactions';
      if (params) {
        const urlParams = new URLSearchParams();
        if (params.cursor) urlParams.set('cursor', params.cursor);
        if (params.limit !== undefined) urlParams.set('limit', params.limit.toString());
        if (params.status) urlParams.set('status', params.status);
        if (params.environment) urlParams.set('environment', params.environment);
        const qs = urlParams.toString();
        if (qs) path += `?${qs}`;
      }
      return this.request<TransactionListData>('GET', path);
    },
  };

  public payouts = {
    initiate: (params: PayoutCreateRequest, options?: RequestOptions) => {
      return this.request<PayoutCreateData>('POST', '/api/v1/payouts', params, options);
    },
  };

  public refunds = {
    initiate: (params: RefundCreateRequest, options?: RequestOptions) => {
      return this.request<RefundCreateData>('POST', '/api/v1/refunds', params, options);
    },
  };

  public c2b = {
    registerUrls: (options?: RequestOptions) => {
      return this.request<C2bRegisterUrlsData>('POST', '/api/v1/c2b/register-urls', undefined, options);
    },
  };
}
