export type ActionResponse<T = any> = {
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
