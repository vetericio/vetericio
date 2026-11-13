import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Permite a plataforma e subdomínios ORICSE sem abrir CORS para sites arbitrários.
function origemAutorizada(req: Request): string {
  const origem = req.headers.get("origin") || "";
  const configurada = Deno.env.get("ORICSE_APP_ORIGIN") || "";
  if (["https://oricse.com.br", "https://app.oricse.com.br",
       "https://www.oricse.com.br", "https://oricse.vetericio.workers.dev",
       configurada].includes(origem) && origem) return origem;
  try {
    const u = new URL(origem);
    if (u.protocol === "https:" && !u.port && u.origin === origem &&
        /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.oricse\.com\.br$/.test(u.hostname))
      return origem;
  } catch {}
  return "https://oricse.com.br";
}
const corsBase = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};


const cpfDigitos = (valor: unknown) => String(valor ?? "").replace(/\D/g, "");
const dataIso = (valor: unknown) => {
  const texto = String(valor ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const partes = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return partes ? partes[3] + "-" + partes[2] + "-" + partes[1] : "";
};
const embaralhar = <T,>(lista: T[]) => {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};

Deno.serve(async (req) => {
  const corsHeaders={...corsBase,"Access-Control-Allow-Origin":origemAutorizada(req)};
  const resposta=(body: Record<string, unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
  const falha=()=>resposta({ ok: false, error: "Não foi possível validar os dados informados. Confira os dados ou procure a clínica." }, 400);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return resposta({ ok: false, error: "Método não permitido." }, 405);

  try {
    const { slug, usuario, cpf, nascimento } = await req.json();
    const clinicaSlug = String(slug ?? "").trim().toLowerCase();
    const cpfNormalizado = cpfDigitos(cpf);
    const nascimentoNormalizado = dataIso(nascimento);
    // Clientes anteriores continuam usando CPF e nascimento durante a atualização.
    const usuarioChave = typeof usuario === "string" ? usuario.trim().replace(/^@/, "").toLowerCase() : "";
    if (usuario !== undefined && !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(usuarioChave)) return falha();
    if (!clinicaSlug || cpfNormalizado.length !== 11 || !nascimentoNormalizado) return falha();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) throw new Error("Configuração do portal indisponível.");
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const ip = (req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
    const { data: permitido, error: erroLimite } = await admin.rpc("oricse_rate_limit_allow", {
      p_escopo: "portal_reset_start",
      p_chave: `${ip}:${clinicaSlug}:${cpfNormalizado}`,
      p_limite: 5,
      p_janela_segundos: 1800,
    });
    // A tabela de desafios já limita solicitações por portal; este limite
    // adicional passa a ser persistente assim que a migration for aplicada.
    if (erroLimite) console.error("Rate limit persistente indisponível", erroLimite.message);
    else if (permitido !== true) return resposta({ ok: false, error: "Aguarde alguns minutos antes de tentar novamente." }, 429);

    const { data: clinica } = await admin
      .from("clinicas")
      .select("id,slug")
      .eq("slug", clinicaSlug)
      .eq("status", "ativa")
      .maybeSingle();
    if (!clinica) return falha();

    const { data: tutor } = await admin
      .from("tutores")
      .select("id,dados")
      .eq("clinica_id", clinica.id)
      .eq("cpf_digitos", cpfNormalizado)
      .maybeSingle();
    const dadosTutor = (tutor?.dados ?? {}) as Record<string, unknown>;
    const nascimentoCadastrado = dataIso(
      dadosTutor.nascimento ?? dadosTutor.dataNascimento ?? dadosTutor.data_nascimento,
    );
    if (!tutor || !nascimentoCadastrado || nascimentoCadastrado !== nascimentoNormalizado) return falha();

    const { data: portal } = await admin
      .from("oricse_portal_tutores")
      .select("id,auth_user_id,usuario_chave")
      .eq("clinica_id", clinica.id)
      .eq("tutor_id", tutor.id)
      .eq("ativo", true)
      .not("auth_user_id", "is", null)
      .maybeSingle();
    if (!portal?.auth_user_id || (usuarioChave && portal.usuario_chave !== usuarioChave)) return falha();

    const { count } = await admin
      .from("oricse_portal_redefinicoes_senha")
      .select("id", { count: "exact", head: true })
      .eq("portal_tutor_id", portal.id)
      .gte("solicitado_em", new Date(Date.now() - 30 * 60 * 1000).toISOString());
    if ((count ?? 0) >= 5) {
      return resposta({ ok: false, error: "Aguarde alguns minutos antes de tentar novamente." }, 429);
    }

    const { data: animais } = await admin
      .from("oricse_animais")
      .select("id,nome")
      .eq("clinica_id", clinica.id)
      .eq("tutor_id", tutor.id)
      .order("nome");
    const pets = (animais ?? []).filter((animal) => String(animal.nome ?? "").trim());
    if (!pets.length) return falha();

    const petCorreto = embaralhar(pets)[0];
    const nomesReais = new Set(pets.map((animal) => String(animal.nome).trim().toLocaleLowerCase("pt-BR")));
    const bancoFalso = [
      "Sol", "Nuvem", "Mel", "Thor", "Luna", "Nina", "Cacau", "Pipoca",
      "Bidu", "Amora", "Jade", "Toby", "Max", "Maya", "Cookie", "Bento",
    ].filter((nome) => !nomesReais.has(nome.toLocaleLowerCase("pt-BR")));
    const alternativasFalsas = embaralhar(bancoFalso).slice(0, 3).map((nome) => ({
      id: crypto.randomUUID(),
      nome,
    }));
    const alternativas = embaralhar([
      { id: petCorreto.id, nome: String(petCorreto.nome).trim() },
      ...alternativasFalsas,
    ]);

    const { data: desafio, error: erroDesafio } = await admin
      .from("oricse_portal_redefinicoes_senha")
      .insert({
        clinica_id: clinica.id,
        tutor_id: tutor.id,
        portal_tutor_id: portal.id,
        resposta_animal_id: petCorreto.id,
        alternativas,
        expira_em: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      })
      .select("id,expira_em")
      .single();
    if (erroDesafio || !desafio) throw erroDesafio ?? new Error("Não foi possível criar o desafio.");

    return resposta({
      ok: true,
      desafioId: desafio.id,
      expiraEm: desafio.expira_em,
      pergunta: "Qual destes é um pet seu?",
      alternativas,
    });
  } catch (error) {
    console.error("oricse-portal-reset-start", error);
    return resposta({ ok: false, error: "Não foi possível iniciar a redefinição agora." }, 500);
  }
});
