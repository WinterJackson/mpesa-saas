import type { PaymentInitiateRequest, PayoutCreateRequest, RefundCreateRequest, C2bRegisterUrlsData, SuccessResponse } from './types';
export declare class PaySwiftError extends Error {
    status?: number;
    details?: any;
    constructor(message: string, status?: number, details?: any);
}
export interface RequestOptions {
    idempotencyKey?: string;
    maxRetries?: number;
}
export declare class PaySwiftClient {
    private apiKey;
    private baseUrl;
    constructor(apiKey: string, baseUrl: string);
    private request;
    payments: {
        initiate: (params: PaymentInitiateRequest, options?: RequestOptions) => Promise<SuccessResponse<{
            transactionId: string;
            checkoutRequestId: string | null;
            status: string;
            merchantRequestID: string;
            customerMessage: string;
        }>>;
        status: (id: string) => Promise<SuccessResponse<{
            transactionId: string;
            status: string;
            amount: number;
            phone: string;
            mpesaReceipt: string | null;
            resultCode: number | null;
            resultDesc: string | null;
            orderReference: string | null;
            createdAt: string;
            updatedAt: string;
        }>>;
    };
    transactions: {
        list: (params?: {
            cursor?: string;
            limit?: number;
            status?: string;
            environment?: "sandbox" | "live";
        }) => Promise<SuccessResponse<{
            transactions: {
                id: string;
                amount: number;
                phone: string;
                status: string;
                orderReference: string | null;
                environment: string;
                source: string;
                mpesaReceipt: string | null;
                createdAt: string;
                updatedAt: string;
            }[];
            nextCursor: string | null;
        }>>;
    };
    payouts: {
        initiate: (params: PayoutCreateRequest, options?: RequestOptions) => Promise<SuccessResponse<{
            payoutId: string;
            status: string;
            conversationId?: string | null | undefined;
            originatorConversationId?: string | null | undefined;
        }>>;
    };
    refunds: {
        initiate: (params: RefundCreateRequest, options?: RequestOptions) => Promise<SuccessResponse<{
            refundId: string;
            status: string;
            amount: number;
            conversationId: string | null;
            originatorConversationId: string | null;
        }>>;
    };
    c2b: {
        registerUrls: (options?: RequestOptions) => Promise<SuccessResponse<C2bRegisterUrlsData>>;
    };
}
//# sourceMappingURL=client.d.ts.map