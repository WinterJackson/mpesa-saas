export type MpesaStatus = 'pending' | 'completed' | 'cancelled' | 'failed' | 'expired';

export function mapResultCodeToStatus(resultCode: number): MpesaStatus {
  if (resultCode === 0) {
    return 'completed';
  } else if (resultCode === 1032) {
    return 'cancelled';
  } else {
    return 'failed';
  }
}
