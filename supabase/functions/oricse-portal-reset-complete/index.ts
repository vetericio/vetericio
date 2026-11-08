import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ORICSE_APP_ORIGIN") || "https://oricse.vetericio.workers.dev",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};
const resposta = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function senhaForte(senha: string) {
  return senha.length >= 12 && senha.length <= 128 && /[a-z]/.test(senha) && /[A-Z]/.test(senha) && /\d/.test(senha) && /[^A-Za-z0-9]/.test(senha);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return resposta({ ok: false, error: "Método não permitido." }, 405);

  try {
    const { desafioId, animalId, senha } = await req.json();
    const senhaNova = String(senha ?? "");
    if (!desafioId || !animalId || !senhaForte(senhaNova)) {
      return resposta({ ok: false, error: "Crie uma senha com pelo menos 12 caracteres, incluindo maiúscula, minúscula, número e símbolo." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) throw new Error("Configuração do portal indisponível.");
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const { data: desafio } = await admin
      .from("oricse_portal_redefinicoes_senha")
      .select("id,portal_tutor_id,resposta_animal_id,tentativas,expira_em,senha_redefinida_em")
      .eq("id", String(desafioId))
      .maybeSingle();
    if (!desafio || desafio.senha_redefinida_em || new Date(desafio.expira_em).getTime() < Date.now() || desafio.tentativas >= 5) {
      return resposta({ ok: false, error: "Este desafio expirou. Inicie a redefinição novamente." }, 400);
    }

    if (String(desafio.resposta_animal_id) !== String(animalId)) {
      await admin
        .from("oricse_portal_redefinicoes_senha")
        .update({ tentativas: Math.min(5, Number(desafio.tentativas) + 1) })
        .eq("id", desafio.id);
      return resposta({ ok: false, error: "A resposta não confere. Tente novamente." }, 400);
    }

    const { data: portal } = await admin
      .from("oricse_portal_tutores")
      .select("id,auth_user_id")
      .eq("id", desafio.portal_tutor_id)
      .eq("ativo", true)
      .maybeSingle();
    if (!portal?.auth_user_id) {
      return resposta({ ok: false, error: "Não foi possível validar este acesso." }, 400);
    }

    const { error: erroSenha } = await admin.auth.admin.updateUserById(portal.auth_user_id, { password: senhaNova });
    if (erroSenha) throw erroSenha;

    const agora = new Date().toISOString();
    await Promise.all([
      admin.from("oricse_portal_tutores").update({ senha_atualizada_em: agora }).eq("id", portal.id),
      admin
        .from("oricse_portal_redefinicoes_senha")
        .update({ respondido_em: agora, senha_redefinida_em: agora })
        .eq("id", desafio.id),
    ]);

    return resposta({ ok: true });
  } catch (error) {
    console.error("oricse-portal-reset-complete", error);
    return resposta({ ok: false, error: "Não foi possível redefinir a senha agora." }, 500);
  }
});
