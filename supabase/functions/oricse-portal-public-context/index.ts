import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ORICSE_APP_ORIGIN") || "https://oricse.vetericio.workers.dev",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Método não permitido." }, 405);

  try {
    const { slug } = await req.json();
    const clinicaSlug = String(slug ?? "").trim().toLowerCase();
    if (!/^[a-z0-9-]{2,80}$/.test(clinicaSlug)) {
      return json({ ok: false, error: "Clínica não encontrada." }, 404);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) throw new Error("Configuração indisponível.");
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const { data: clinica } = await admin
      .from("clinicas")
      .select("nome,slug,logo_url")
      .eq("slug", clinicaSlug)
      .eq("status", "ativa")
      .maybeSingle();

    if (!clinica) return json({ ok: false, error: "Clínica não encontrada." }, 404);
    return json({ ok: true, clinica });
  } catch (error) {
    console.error("oricse-portal-public-context", error);
    return json({ ok: false, error: "Portal indisponível." }, 500);
  }
});
