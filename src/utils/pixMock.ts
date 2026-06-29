import { Transaction } from '@/src/types';

// Generates a mock Pix copia-e-cola payload and a data string for the QR code.
// In production this would call the payment API.
export function mockPixPayload(params: {
  pixKey: string;
  amount: number; // cents
  description: string;
  merchantName: string;
}): Pick<Transaction, 'pix_copy_paste' | 'pix_qr_code'> {
  const brl = (params.amount / 100).toFixed(2);
  const merchantName = params.merchantName.substring(0, 25).toUpperCase();
  const description = (params.description || 'COBRANCA').substring(0, 25).toUpperCase();

  // Simplified EMV payload (not a real Pix payload — for demo only)
  const payload = [
   `${params.pixKey}`,
                                 // CRC placeholder
  ].join('');


  return {
    pix_copy_paste: payload + crc,
    pix_qr_code: payload + crc, // QR code encodes the same payload
  };
}
