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

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function base64Url(input: ArrayBuffer | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getGoogleAccessToken(serviceAccount: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsignedJwt));
  const assertion = `${unsignedJwt}.${base64Url(signature)}`;

  const tokenResponse = await fetch(serviceAccount.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    console.error("Google token request failed:", tokenResponse.status, tokenData);
    throw new Error("google_auth_failed");
  }

  return tokenData.access_token as string;
}

async function verifyProductPurchase(packageName: string, productId: string, purchaseToken: string, accessToken: string) {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();

  if (!response.ok) {
    console.error("Google purchase verification failed:", response.status, data);
    throw new Error("purchase_verification_failed");
  }

  return data;
}

async function consumeProductPurchase(packageName: string, productId: string, purchaseToken: string, accessToken: string) {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:consume`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const data = await response.text();
    console.error("Google purchase consume failed:", response.status, data);
    throw new Error("purchase_consume_failed");
  }
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
    const packageName = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME") || "com.arsaanaliz.app";
    const serviceAccountJson = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");

    if (!supabaseUrl || !serviceRoleKey || !serviceAccountJson) {
      return jsonResponse({ error: "Ödeme sistemi henüz yapılandırılmadı." }, 503);
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Satın alma için giriş yapmanız gerekiyor." }, 401);
    }

    const { productId, purchaseToken, deviceId } = await req.json();
    const credits = PRODUCT_CREDITS[productId as string];

    if (!credits || typeof purchaseToken !== "string" || purchaseToken.length < 10) {
      return jsonResponse({ error: "Satın alma bilgisi geçersiz." }, 400);
    }

    if (typeof deviceId !== "string" || !DEVICE_ID_PATTERN.test(deviceId)) {
      return jsonResponse({ error: "Cihaz kimliği geçersiz." }, 400);
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": authHeader,
      },
    });

    if (!userResponse.ok) {
      return jsonResponse({ error: "Oturum doğrulanamadı. Lütfen tekrar giriş yapın." }, 401);
    }

    const userData = await userResponse.json();
    const userId = userData?.id;
    if (!userId) {
      return jsonResponse({ error: "Oturum doğrulanamadı. Lütfen tekrar giriş yapın." }, 401);
    }

    const serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const purchase = await verifyProductPurchase(packageName, productId, purchaseToken, accessToken);

    if (purchase.purchaseState !== 0) {
      return jsonResponse({ error: "Satın alma tamamlanmadı." }, 402);
    }

    const grantResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/grant_google_play_purchase_credits`, {
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
        p_purchase_token: purchaseToken,
        p_credits: credits,
      }),
    });

    const grantText = await grantResponse.text();
    const grantResult = grantText ? JSON.parse(grantText) : null;

    if (!grantResponse.ok || !grantResult?.success) {
      console.error("Credit grant failed:", grantResponse.status, grantResult);
      return jsonResponse({ error: "Ödeme alındı ancak kredi eklenemedi. Destek ile iletişime geçin." }, 500);
    }

    if (purchase.consumptionState === 0) {
      await consumeProductPurchase(packageName, productId, purchaseToken, accessToken);
    }

    return jsonResponse({
      success: true,
      credits,
      total_credits: grantResult.total_credits,
      already_applied: Boolean(grantResult.already_applied),
    });
  } catch (error) {
    console.error("verify-google-play-purchase error:", error);
    return jsonResponse({ error: "Ödeme doğrulanamadı. Lütfen biraz sonra tekrar deneyin." }, 500);
  }
});
