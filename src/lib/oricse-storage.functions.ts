import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { validarVersaoEstado } from "@/lib/drive-cas";

const inputSchema = z.object({ accessToken: z.string().min(20) });
const salvarSchema = inputSchema.extend({
  alteracoes: z.array(z.object({
    chave: z.string().min(1).max(240),
    valor: z.string().nullable(),
    esperado: z.string().nullable().optional(),
  })).min(1).max(500),
});

async function carregarAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function contextoUsuario(accessToken: string) {
  const admin = await carregarAdmin();
  const { data: auth, error } = await admin.auth.getUser(accessToken);
  if (error || !auth.user) throw new Error("Sessão inválida ou expirada.");
  const userId = auth.user.id;
  const { data: perfil, error: perfilErro } = await admin.from("app_users").select("role").eq("user_id", userId).maybeSingle();
  if (perfilErro) throw perfilErro;
  if (perfil?.role === "admin") return { userId, clinicaId: null as string | null };
  const { data: vinculos, error: vinculoErro } = await admin.from("clinica_usuarios").select("clinica_id").eq("user_id", userId).eq("ativo", true).limit(2);
  if (vinculoErro) throw vinculoErro;
  if (!vinculos?.length) throw new Error("Usuário sem vínculo ativo com clínica.");
  if (vinculos.length > 1) throw new Error("Usuário possui mais de uma clínica ativa.");
  return { userId, clinicaId: String(vinculos[0].clinica_id) };
}

/** Estado principal no PostgreSQL; o trigger da tabela enfileira a cópia para o Drive. */
async function lerEstado(accessToken: string) {
  const contexto = await contextoUsuario(accessToken);
  if (!contexto.clinicaId) return { contexto, estado: {} as Record<string, string> };
  const admin = await carregarAdmin();
  const { data, error } = await admin.from("oricse_dados_modulos")
    .select("dados")
    .eq("clinica_id", contexto.clinicaId)
    .eq("chave", "estado_sistema")
    .maybeSingle();
  if (error) throw error;
  const bruto = data?.dados;
  const estado = bruto && typeof bruto === "object" && !Array.isArray(bruto) ? bruto as Record<string, unknown> : {};
  return {
    contexto,
    estado: Object.fromEntries(Object.entries(estado).filter(([, valor]) => typeof valor === "string").map(([chave, valor]) => [chave, valor as string])),
  };
}

export const carregarEstadoOricseDrive = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { estado } = await lerEstado(data.accessToken);
    return { estado, atualizadoEm: null as string | null };
  });

export async function salvarEstadoOricseInterno(data: z.infer<typeof salvarSchema>) {
  const { contexto, estado } = await lerEstado(data.accessToken);
  if (!contexto.clinicaId) return { ok: true, quantidade: 0 };
  validarVersaoEstado(estado, data.alteracoes);
  for (const alteracao of data.alteracoes) {
    if (alteracao.valor === null) delete estado[alteracao.chave];
    else estado[alteracao.chave] = alteracao.valor;
  }
  const admin = await carregarAdmin();
  const { error } = await admin.from("oricse_dados_modulos").upsert({
    clinica_id: contexto.clinicaId,
    chave: "estado_sistema",
    dados: estado,
    atualizado_por: contexto.userId,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: "clinica_id,chave" });
  if (error) throw error;
  return { ok: true, quantidade: Object.keys(estado).length };
}

export const salvarEstadoOricseDrive = createServerFn({ method: "POST" })
  .validator((input: unknown) => salvarSchema.parse(input))
  .handler(async ({ data }) => salvarEstadoOricseInterno(data));
