import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function getAllowedOrigins() {
  return (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173,http://127.0.0.1:5173")
    .split(",").map((origin) => origin.trim()).filter(Boolean);
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getSecretKey() {
  const keyMap = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keyMap) {
    try {
      const parsed = JSON.parse(keyMap) as Record<string, string>;
      if (parsed.default) return parsed.default;
      const first = Object.values(parsed)[0];
      if (first) return first;
    } catch { /* check the legacy runtime variable below */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigins = getAllowedOrigins();
  const corsHeaders = {
    ...jsonHeaders,
    "access-control-allow-origin": allowedOrigins.includes(origin) ? origin : "null",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "Origin",
  };

  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: corsHeaders });
  if (!allowedOrigins.includes(origin)) return new Response(JSON.stringify({ error: "Origin not allowed." }), { status: 403, headers: corsHeaders });
  const bodySize = Number(request.headers.get("content-length") ?? 0);
  if (bodySize > 16000) return new Response(JSON.stringify({ error: "Request is too large." }), { status: 413, headers: corsHeaders });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: "Invalid request." }), { status: 400, headers: corsHeaders }); }

  // A filled hidden field is treated as spam. Return a generic success to avoid helping bots tune submissions.
  if (typeof body.website === "string" && body.website.trim()) return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const email = typeof body.business_email === "string" ? body.business_email.trim() : "";
  const country = typeof body.country === "string" ? body.country.trim() : "";
  const productName = typeof body.product_name === "string" ? body.product_name.trim() : "";
  const quantity = typeof body.estimated_quantity === "string" ? body.estimated_quantity.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const key = typeof body.idempotency_key === "string" ? body.idempotency_key : "";
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (name.length < 1 || name.length > 120 || !validEmail(email) || country.length < 2 || country.length > 100 ||
      productName.length < 1 || productName.length > 180 || message.length < 1 || message.length > 5000 ||
      company.length > 180 || quantity.length > 80 || !uuidPattern.test(key)) {
    return new Response(JSON.stringify({ error: "Please check the required fields and try again." }), { status: 400, headers: corsHeaders });
  }

  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const hashSecret = Deno.env.get("INQUIRY_HASH_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const secretKey = getSecretKey();
  if (!ip || hashSecret.length < 32 || !supabaseUrl || !secretKey) {
    console.error("Inquiry function is missing server configuration or client IP headers.");
    return new Response(JSON.stringify({ error: "Inquiry service is temporarily unavailable." }), { status: 503, headers: corsHeaders });
  }

  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${hashSecret}:${ip}`));
  const ipHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const supabase = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const productId = typeof body.product_id === "string" && uuidPattern.test(body.product_id) ? body.product_id : null;
  const { data, error } = await supabase.rpc("submit_catalog_inquiry", {
    p_idempotency_key: key,
    p_name: name,
    p_company: company || null,
    p_business_email: email,
    p_country: country,
    p_product_id: productId,
    p_product_name: productName,
    p_estimated_quantity: quantity || null,
    p_message: message,
    p_ip_hash: ipHash,
  });

  if (error) {
    if (error.message.includes("Inquiry limit reached")) return new Response(JSON.stringify({ error: "Too many inquiries from this connection. Please try again later." }), { status: 429, headers: corsHeaders });
    console.error("Inquiry database request failed:", error.code ?? "unknown");
    return new Response(JSON.stringify({ error: "We could not save your inquiry. Please try again." }), { status: 500, headers: corsHeaders });
  }
  return new Response(JSON.stringify({ ok: true, id: data }), { status: 201, headers: corsHeaders });
});
