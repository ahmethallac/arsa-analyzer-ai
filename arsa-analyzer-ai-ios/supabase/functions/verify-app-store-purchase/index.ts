import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRODUCT_CREDITS: Record<string, number> = {
  package_10: 10,
  package_20: 20,
  package_50: 50,
};

const DEVICE_ID_PATTERN = /^device_[a-zA-Z0-9_]{5,90}$/;
const APPLE_PRODUCTION_VERIFY_URL = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX_VERIFY_URL = "https://sandbox.itunes.apple.com/verifyReceipt";

type AppleReceiptItem = {
  product_id?: string;
  transaction_id?: string;
  original_transaction_id?: string;
  cancellation_date?: string;
};

type AppleVerifyResponse = {
  status?: number;
  environment?: string;
  receipt?: {
    bundle_id?: string;
    in_app?: AppleReceiptItem[];
  };
  latest_receipt_info?: AppleReceiptItem[];
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function postAppleReceipt(url: string, receipt: string, sharedSecret?: string) {
  const payload: Record<string, unknown> = {
    "receipt-data": receipt,
    "exclude-old-transactions": true,
  };

  if (sharedSecret) {
    payload.password = sharedSecret;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Apple receipt request failed:", response.status, data);
    throw new Error("apple_receipt_request_failed");
  }

  return data as AppleVerifyResponse;
}

async function verifyAppleReceipt(receipt: string, sharedSecret?: string) {
  const productionResult = await postAppleReceipt(APPLE_PRODUCTION_VERIFY_URL, receipt, sharedSecret);

  if (productionResult.status === 21007) {
    return postAppleReceipt(APPLE_SANDBOX_VERIFY_URL, receipt, sharedSecret);
  }

  return productionResult;
}

function findVerifiedPurchase(data: AppleVerifyResponse, productId: string, transactionId: string) {
  const receiptItems = Array.isArray(data.receipt?.in_app) ? data.receipt.in_app : [];
  const latestItems = Array.isArray(data.latest_receipt_info) ? data.latest_receipt_info : [];

  return [...receiptItems, ...latestItems].find((item) => {
    const matchesProduct = item.product_id === productId;
    const matchesTransaction = item.transaction_id === transactionId || item.original_transaction_id === transactionId;
    const notCancelled = !item.cancellation_date;
    return matchesProduct && matchesTransaction && notCancelled;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const bundleId = Deno.env.get("APP_STORE_BUNDLE_ID") || "com.arsaanaliz.app";
    const sharedSecret = Deno.env.get("APP_STORE_SHARED_SECRET");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Odeme sistemi henuz yapilandirilmadi." }, 503);
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Satin alma icin giris yapmaniz gerekiyor." }, 401);
    }

    const { productId, transactionId, receipt, deviceId } = await req.json();
    const credits = PRODUCT_CREDITS[productId as string];

    if (!credits || typeof transactionId !== "string" || transactionId.length < 5) {
      return jsonResponse({ error: "Satin alma bilgisi gecersiz." }, 400);
    }

    if (typeof receipt !== "string" || receipt.length < 100) {
      return jsonResponse({ error: "App Store makbuzu gecersiz." }, 400);
    }

    if (typeof deviceId !== "string" || !DEVICE_ID_PATTERN.test(deviceId)) {
      return jsonResponse({ error: "Cihaz kimligi gecersiz." }, 400);
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": authHeader,
      },
    });

    if (!userResponse.ok) {
      return jsonResponse({ error: "Oturum dogrulanamadi. Lutfen tekrar giris yapin." }, 401);
    }

    const userData = await userResponse.json();
    const userId = userData?.id;
    if (!userId) {
      return jsonResponse({ error: "Oturum dogrulanamadi. Lutfen tekrar giris yapin." }, 401);
    }

    const appleReceipt = await verifyAppleReceipt(receipt, sharedSecret || undefined);
    if (appleReceipt.status !== 0) {
      console.error("Apple receipt verification failed:", appleReceipt.status, appleReceipt);
      return jsonResponse({ error: "App Store satin alma dogrulanamadi." }, 402);
    }

    if (appleReceipt.receipt?.bundle_id !== bundleId) {
      console.error("Apple bundle id mismatch:", appleReceipt.receipt?.bundle_id);
      return jsonResponse({ error: "App Store makbuzu bu uygulama icin degil." }, 402);
    }

    const purchase = findVerifiedPurchase(appleReceipt, productId as string, transactionId);
    if (!purchase) {
      return jsonResponse({ error: "Bu App Store satin alma kaydi bulunamadi." }, 402);
    }

    const grantResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/grant_app_store_purchase_credits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_device_id: deviceId,
        p_product_id: productId,
        p_transaction_id: transactionId,
        p_credits: credits,
      }),
    });

    const grantText = await grantResponse.text();
    const grantResult = grantText ? JSON.parse(grantText) : null;

    if (!grantResponse.ok || !grantResult?.success) {
      console.error("App Store credit grant failed:", grantResponse.status, grantResult);
      return jsonResponse({ error: "Odeme alindi ancak kredi eklenemedi. Destek ile iletisime gecin." }, 500);
    }

    return jsonResponse({
      success: true,
      credits,
      total_credits: grantResult.total_credits,
      already_applied: Boolean(grantResult.already_applied),
    });
  } catch (error) {
    console.error("verify-app-store-purchase error:", error);
    return jsonResponse({ error: "Odeme dogrulanamadi. Lutfen biraz sonra tekrar deneyin." }, 500);
  }
});
