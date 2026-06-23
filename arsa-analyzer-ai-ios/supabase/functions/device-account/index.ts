import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEVICE_ID_PATTERN = /^device_[a-zA-Z0-9_]{5,90}$/;
const PROMO_CODE_PATTERN = /^[A-Za-z0-9]{3,20}$/;

type DeviceProfile = {
  id: string;
  device_id: string;
  credits: number;
  created_at: string;
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const validateDeviceId = (deviceId: unknown): deviceId is string =>
  typeof deviceId === "string" &&
  deviceId.length >= 10 &&
  deviceId.length <= 100 &&
  DEVICE_ID_PATTERN.test(deviceId);

const getEnv = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service credentials are not configured");
  }

  return { supabaseUrl, serviceRoleKey };
};

async function callRpc<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const { supabaseUrl, serviceRoleKey } = getEnv();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    console.error(`${functionName} RPC failed:`, response.status, data);
    throw new Error(data?.message || `${functionName} failed`);
  }

  return data as T;
}

async function getOrCreateProfile(deviceId: string): Promise<DeviceProfile> {
  const data = await callRpc<DeviceProfile[]>("get_or_create_device_profile", {
    p_device_id: deviceId,
  });

  if (!Array.isArray(data) || !data[0]) {
    throw new Error("Device profile could not be loaded");
  }

  return data[0];
}

async function getTransactions(profileId: string) {
  const { supabaseUrl, serviceRoleKey } = getEnv();
  const params = new URLSearchParams({
    select: "id,amount,type,description,created_at",
    user_id: `eq.${profileId}`,
    order: "created_at.desc",
    limit: "10",
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/credit_transactions?${params}`, {
    headers: {
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Transaction lookup failed:", response.status, data);
    throw new Error(data?.message || "Transactions could not be loaded");
  }

  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { action, deviceId, promoCode } = await req.json();

    if (!validateDeviceId(deviceId)) {
      return jsonResponse({ error: "Gecersiz cihaz kimligi" }, 400);
    }

    if (action === "profile") {
      const profile = await getOrCreateProfile(deviceId);
      return jsonResponse({ success: true, profile });
    }

    if (action === "transactions") {
      const profile = await getOrCreateProfile(deviceId);
      const transactions = await getTransactions(profile.id);
      return jsonResponse({ success: true, transactions });
    }

    if (action === "applyPromo") {
      if (typeof promoCode !== "string" || !PROMO_CODE_PATTERN.test(promoCode)) {
        return jsonResponse({ success: false, error: "Gecersiz promosyon kodu" }, 400);
      }

      const result = await callRpc("apply_promo_code", {
        p_device_id: deviceId,
        p_code: promoCode,
      });

      return jsonResponse(result);
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("device-account error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Beklenmeyen bir hata olustu" },
      500,
    );
  }
});
