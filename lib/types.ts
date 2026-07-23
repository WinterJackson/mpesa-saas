export type ActionResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface DarajaCallbackMetadataItem {
  Name: string;
  Value?: string | number;
}

export interface DarajaStkCallback {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  CallbackMetadata?: {
    Item: DarajaCallbackMetadataItem[];
  };
}

export interface DarajaCallbackBody {
  stkCallback: DarajaStkCallback;
}

export interface DarajaCallbackPayload {
  Body: DarajaCallbackBody;
}

export interface InitiatePaymentRequest {
  phone: string;
  amount: number;
  orderReference?: string;
}

// ─── Daraja async Result callbacks (B2C / Reversal / Account Balance / Tx Status) ──
export interface DarajaResultParameter {
  Key: string;
  Value?: string | number;
}

export interface DarajaResult {
  ResultType?: number;
  ResultCode: number;
  ResultDesc: string;
  OriginatorConversationID: string;
  ConversationID?: string;
  TransactionID?: string;
  ResultParameters?: {
    ResultParameter: DarajaResultParameter[] | DarajaResultParameter;
  };
  ReferenceData?: unknown;
}

export interface DarajaResultPayload {
  Result: DarajaResult;
}

/** Extracts a named value from a Daraja Result's ResultParameters. */
export function findResultParam(result: DarajaResult, key: string): string | number | undefined {
  const params = result.ResultParameters?.ResultParameter;
  if (!params) return undefined;
  const list = Array.isArray(params) ? params : [params];
  return list.find((p) => p.Key === key)?.Value;
}

// C2B confirmation/validation payload (customer-initiated Paybill/Till).
export interface DarajaC2BPayload {
  TransactionType?: string;
  TransID: string;
  TransTime?: string;
  TransAmount: string | number;
  BusinessShortCode: string;
  BillRefNumber?: string;
  MSISDN: string;
  FirstName?: string;
  LastName?: string;
}
