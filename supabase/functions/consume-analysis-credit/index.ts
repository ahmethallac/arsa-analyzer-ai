import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEVICE_ID_PATTERN = /^device_[a-zA-Z0-9_]{5,90}$/;

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

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase service credentials are not configured");
      return jsonResponse({ error: "Kredi sistemi yapılandırılmamış. Lütfen daha sonra tekrar deneyin." }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Kredi kullanımı için giriş yapmanız gerekiyor." }, 401);
    }

    const { deviceId } = await req.json();
    if (!validateDeviceId(deviceId)) {
      return jsonResponse({ error: "Geçersiz cihaz kimliği" }, 400);
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": authHeader,
      },
    });

    if (!userResponse.ok) {
      console.error("User verification failed:", userResponse.status, await userResponse.text());
      return jsonResponse({ error: "Oturum doğrulanamadı. Lütfen tekrar giriş yapın." }, 401);
    }

    const userData = await userResponse.json();
    const userId = userData?.id;
    if (!userId) {
      return jsonResponse({ error: "Oturum kullanıcısı bulunamadı. Lütfen tekrar giriş yapın." }, 401);
    }

    const debitResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/deduct_credit_for_user_device`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ p_user_id: userId, p_device_id: deviceId }),
    });

    const debitText = await debitResponse.text();
    const debitResult = debitText ? JSON.parse(debitText) : false;
    console.log("PDF-confirmed credit deduction result:", debitResponse.status, debitResult);

    if (!debitResponse.ok) {
      console.error("Credit deduction failed:", debitResponse.status, debitResult);
      return jsonResponse({ error: "Kredi düşümü tamamlanamadı. Lütfen tekrar deneyin." }, 500);
    }

    if (!debitResult) {
      return jsonResponse({ error: "Yetersiz kredi. Lütfen kredi satın alın." }, 402);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("consume-analysis-credit error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu" },
      500,
    );
  }
});
