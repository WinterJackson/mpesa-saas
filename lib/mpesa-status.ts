export function mapResultCodeToStatus(resultCode: number): 'completed' | 'cancelled' | 'failed' {
  if (resultCode === 0) {
    return 'completed';
  } else if (resultCode === 1032) {
    return 'cancelled';
  } else {
    return 'failed';
  }
}
