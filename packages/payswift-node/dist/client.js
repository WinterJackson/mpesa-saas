"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaySwiftClient = exports.PaySwiftError = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
class PaySwiftError extends Error {
    status;
    details;
    constructor(message, status, details) {
        super(message);
        this.name = 'PaySwiftError';
        this.status = status;
        this.details = details;
    }
}
exports.PaySwiftError = PaySwiftError;
class PaySwiftClient {
    apiKey;
    baseUrl;
    constructor(apiKey, baseUrl) {
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
    async request(method, path, body, options) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        if (options?.idempotencyKey) {
            headers['Idempotency-Key'] = options.idempotencyKey;
        }
        else if (method === 'POST') {
            headers['Idempotency-Key'] = node_crypto_1.default.randomUUID();
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
                const data = (await response.json());
                if (!response.ok || !data.success) {
                    // 4xx errors are thrown immediately without retrying
                    throw new PaySwiftError(data.error || `HTTP ${response.status}`, response.status, data);
                }
                return data;
            }
            catch (error) {
                if (error instanceof PaySwiftError) {
                    throw error;
                }
                if (attempt >= maxRetries) {
                    throw new PaySwiftError(`Request failed after ${maxRetries} retries: ${error.message}`, undefined, error);
                }
                attempt++;
                // Exponential backoff: 500ms, 1000ms, 2000ms...
                const backoffMs = 500 * Math.pow(2, attempt - 1);
                await new Promise((resolve) => setTimeout(resolve, backoffMs));
            }
        }
        throw new PaySwiftError('Unexpected failure');
    }
    payments = {
        initiate: (params, options) => {
            return this.request('POST', '/api/v1/payments/initiate', params, options);
        },
        status: (id) => {
            return this.request('GET', `/api/v1/payments/status/${encodeURIComponent(id)}`);
        },
    };
    transactions = {
        list: (params) => {
            let path = '/api/v1/transactions';
            if (params) {
                const urlParams = new URLSearchParams();
                if (params.cursor)
                    urlParams.set('cursor', params.cursor);
                if (params.limit !== undefined)
                    urlParams.set('limit', params.limit.toString());
                if (params.status)
                    urlParams.set('status', params.status);
                if (params.environment)
                    urlParams.set('environment', params.environment);
                const qs = urlParams.toString();
                if (qs)
                    path += `?${qs}`;
            }
            return this.request('GET', path);
        },
    };
    payouts = {
        initiate: (params, options) => {
            return this.request('POST', '/api/v1/payouts', params, options);
        },
    };
    refunds = {
        initiate: (params, options) => {
            return this.request('POST', '/api/v1/refunds', params, options);
        },
    };
    c2b = {
        registerUrls: (options) => {
            return this.request('POST', '/api/v1/c2b/register-urls', undefined, options);
        },
    };
}
exports.PaySwiftClient = PaySwiftClient;
//# sourceMappingURL=client.js.map