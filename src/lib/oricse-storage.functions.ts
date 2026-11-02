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

/**
 * As rotas legadas gravam módulos como documentos JSON. Sem este controle,
 * alguém poderia chamar a função de gravação diretamente e contornar o plano.
 * Atualizações pessoais sem impacto clínico/financeiro não exigem recurso.
 */
function permissoesDaChave(chave: string): string[] {
  const exatas: Record<string, string[]> = {
    "oricse-tutores-v1": ["recepcao.cadastros.editar", "consultorio.atendimentos"],
    "oricse-animais-v1": ["recepcao.cadastros.editar", "consultorio.atendimentos"],
    "oricse-prontuario-animal-v1": ["consultorio.atendimentos"],
    "oricse-pesos-animal-v1": ["consultorio.atendimentos"],
    "oricse-comandas-v1": ["caixa.comandas"],
    "oricse-financeiro-lancamentos-v1": ["caixa.financeiro.gerenciar"],
    "oricse-fila-espera-v1": ["recepcao.agenda"],
    "oricse-lembretes-reforcos-v1": ["crm.enviar"],
    "veterico-registros-v1": ["internacao.registrar"],
    "veterico-anamneses": ["internacao.registrar"],
    "veterico-curvas-v1": ["internacao.registrar"],
    "oricse:modulo:anamneses": ["internacao.registrar"],
    "oricse:modulo:curvas": ["internacao.registrar"],
    "veterico-alarmes-v1": ["internacao.registrar"],
    "veterico-pendencias-v1": ["internacao.registrar"],
    "veterico-alertas-v1": ["internacao.registrar"],
    "veterico-regras-alerta-v1": ["internacao.registrar"],
    "veterico-bloco-notas": ["internacao.registrar"],
    "veterico-plantoes-v1": ["internacao.plantoes"],
    "veterico-plantao-v1": ["internacao.plantoes"],
    "veterico-medicamentos-v1": ["consultorio.medicacoes", "internacao.medicacoes"],
    "veterico-medicamentos-padrao-v1": ["consultorio.medicacoes", "internacao.medicacoes"],
    "veterico-referencias-exames-v2": ["consultorio.atendimentos"],
    "vetericio-exames-favoritos": ["consultorio.atendimentos"],
    "vetericio-termos-clinica": ["consultorio.receituario"],
    "veterico-assinatura-v1": ["consultorio.receituario"],
    "veterico-carimbo-v1": ["consultorio.receituario"],
    "veterico:precisao-ml": ["consultorio.medicacoes", "internacao.medicacoes"],
    "vetericio-logo-cabecalho-v1": ["administracao.configuracoes"],
    "veterico-tema-v1": ["administracao.temas"],
    "veterico-tema-v2": ["administracao.temas"],
    "veterico-tema-cor-v1": ["administracao.temas"],
    "veterico-temas-personalizados-v1": ["administracao.temas"],
  };
  if (exatas[chave]) return exatas[chave];
  if (chave.startsWith("oricse-rascunho-consulta-")) return ["consultorio.atendimentos"];
  return [];
}

async function obterPermissoesUsuario(
  accessToken: string,
  contexto: { userId: string; clinicaId: string | null },
): Promise<Set<string>> {
  if (!contexto.clinicaId) return new Set();
  const admin = await carregarAdmin();
  const { createDriveFrom } = await import("@/lib/drive-db");
  const { createDriveRpc } = await import("@/lib/drive-rpc");
  const rpc = createDriveRpc({
    auth: {
      getUser: async () => ({ data: { user: { id: contexto.userId } }, error: null }),
      getSession: async () => ({ data: { session: { access_token: accessToken } }, error: null }),
    },
    fromDrive: createDriveFrom(async () => accessToken),
    fromIdentity: (tabela: string) => (admin as any).from(tabela),
    getSelectedClinicId: async () => contexto.clinicaId,
  });
  const { data, error } = await rpc("oricse_permissoes_efetivas", {
    p_clinica_id: contexto.clinicaId,
    p_user_id: contexto.userId,
  });
  if (error || !Array.isArray(data)) {
    throw new Error(error?.message || "Não foi possível conferir os acessos do plano.");
  }
  return new Set<string>(data.filter((p: any) => p.permitido).map((p: any) => String(p.codigo)));
}

async function validarAlteracoesPorPlano(
  accessToken: string,
  contexto: { userId: string; clinicaId: string | null },
  alteracoes: Array<{ chave: string }>,
) {
  if (!contexto.clinicaId) return;
  const regras = new Map<string, string[]>();
  for (const item of alteracoes) {
    const candidatas = permissoesDaChave(item.chave);
    if (candidatas.length) regras.set(item.chave, candidatas);
  }
  if (!regras.size) return;
  const permitidas = await obterPermissoesUsuario(accessToken, contexto);
  for (const [chave, candidatas] of regras) {
    if (!candidatas.some((codigo) => permitidas.has(codigo))) {
      throw new Error("O plano ou cargo não permite alterar o recurso: " + chave);
    }
  }
}

/** Estado principal no PostgreSQL; o trigger da tabela enfileira a cópia para o Drive. */
async function lerEstado(accessToken: string, filtrarLeitura = false) {
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
  let pares = Object.entries(estado)
    .filter(([, valor]) => typeof valor === "string")
    .map(([chave, valor]) => [chave, valor as string] as const);
  if (filtrarLeitura && pares.some(([chave]) => permissoesDaChave(chave).length)) {
    const permitidas = await obterPermissoesUsuario(accessToken, contexto);
    pares = pares.filter(([chave]) => {
      const exigidas = permissoesDaChave(chave);
      return !exigidas.length || exigidas.some((codigo) => permitidas.has(codigo));
    });
  }
  return { contexto, estado: Object.fromEntries(pares) };
}

export const carregarEstadoOricseDrive = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { estado } = await lerEstado(data.accessToken, true);
    return { estado, atualizadoEm: null as string | null };
  });

export async function salvarEstadoOricseInterno(data: z.infer<typeof salvarSchema>) {
  const { contexto, estado } = await lerEstado(data.accessToken);
  if (!contexto.clinicaId) return { ok: true, quantidade: 0 };
  await validarAlteracoesPorPlano(data.accessToken, contexto, data.alteracoes);
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
