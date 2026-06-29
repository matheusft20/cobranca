import { Transaction } from '@/src/types';

export function mockPixPayload(params: {
  pixKey: string;
  amount: number;
  description: string;
  merchantName: string;
}): Pick<Transaction, 'pix_copy_paste' | 'pix_qr_code'> {
  return {
    pix_copy_paste: params.pixKey.trim(),
    pix_qr_code: params.pixKey.trim(),
  };
}
