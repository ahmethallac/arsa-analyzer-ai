import { supabase } from '@/integrations/supabase/client';
import { toFriendlyErrorMessage } from '@/lib/api';

export interface CreditProduct {
  id: 'package_10' | 'package_20' | 'package_50';
  credits: number;
  priceLabel: string;
}

export const CREDIT_PRODUCTS: CreditProduct[] = [
  { id: 'package_10', credits: 10, priceLabel: '150 TL' },
  { id: 'package_20', credits: 20, priceLabel: '250 TL' },
  { id: 'package_50', credits: 50, priceLabel: '500 TL' },
];

interface VerifyPurchaseResponse {
  success: boolean;
  credits?: number;
  total_credits?: number;
  already_applied?: boolean;
  error?: string;
}

async function invokePurchaseVerification(functionName: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<VerifyPurchaseResponse>(functionName, {
    body,
  });

  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      let backendMessage = '';
      try {
        const payload = await context.clone().json();
        backendMessage = payload?.error || '';
      } catch {
        backendMessage = '';
      }
      throw new Error(toFriendlyErrorMessage(backendMessage || 'Odeme dogrulanamadi.'));
    }
    throw new Error(toFriendlyErrorMessage(error.message));
  }

  if (!data?.success) {
    throw new Error(toFriendlyErrorMessage(data?.error || 'Odeme dogrulanamadi.'));
  }

  return data;
}

export async function verifyGooglePlayPurchase(params: {
  productId: string;
  purchaseToken: string;
  deviceId: string;
}) {
  return invokePurchaseVerification('verify-google-play-purchase', params);
}

export async function verifyAppStorePurchase(params: {
  productId: string;
  transactionId: string;
  receipt: string;
  deviceId: string;
}) {
  return invokePurchaseVerification('verify-app-store-purchase', params);
}
