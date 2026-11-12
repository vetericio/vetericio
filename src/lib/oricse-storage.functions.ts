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
  // A clínica escolhida é uma seleção explícita e persistida por usuário.
  // Nunca confirmar uma gravação sem clínica: antes isso retornava { ok: true } sem salvar nada.
  const { data: selecao, error: erroSelecao } = await admin.from("oricse_clinica_ativa_usuario")
    .select("clinica_id").eq("user_id", userId).maybeSingle();
  if (erroSelecao) throw new Error("Não foi possível confirmar a clínica selecionada: " + erroSelecao.message);
  const { data: vinculos, error: vinculoErro } = await admin.from("clinica_usuarios")
    .select("clinica_id").eq("user_id", userId).eq("ativo", true);
  if (vinculoErro) throw new Error("Não foi possível verificar seus vínculos com clínicas: " + vinculoErro.message);
  let clinicaId: string | null = null;
  if (perfil?.role === "admin") {
    clinicaId = selecao?.clinica_id ? String(selecao.clinica_id) : null;
    if (!clinicaId) throw new Error("Selecione uma clínica ativa no Admin antes de salvar.");
  } else {
    const permitidos = (vinculos || []).map((v) => String(v.clinica_id));
    if (!permitidos.length) throw new Error("Usuário sem vínculo ativo com clínica.");
    if (selecao?.clinica_id && permitidos.includes(String(selecao.clinica_id))) {
      clinicaId = String(selecao.clinica_id);
    } else if (permitidos.length === 1) {
      clinicaId = permitidos[0];
    } else {
      throw new Error("Selecione uma clínica ativa antes de salvar.");
    }
  }
  const { data: clinica, error: erroClinica } = await admin.from("clinicas")
    .select("id,status,excluido_em").eq("id", clinicaId).maybeSingle();
  if (erroClinica || !clinica || clinica.status !== "ativa" || clinica.excluido_em) {
    throw new Error("A clínica selecionada não está ativa ou não foi encontrada.");
  }
  return { userId, clinicaId, adminGeral: perfil?.role === "admin" };
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
  if (!contexto.clinicaId) throw new Error("Clínica não selecionada.");
  const admin = await carregarAdmin();
  const { createDriveRpc } = await import("@/lib/drive-rpc");
  const rpc = createDriveRpc({
    auth: {
      getUser: async () => ({ data: { user: { id: contexto.userId } }, error: null }),
      getSession: async () => ({ data: { session: { access_token: accessToken } }, error: null }),
    },
    // Regras de acesso são oficiais no PostgreSQL: não depender de uma cópia
    // no Google Drive para autorizar gravação operacional de pacientes/atendimentos.
    fromDrive: (tabela: string) => (admin as any).from(tabela),
    fromIdentity: (tabela: string) => (admin as any).from(tabela),
    // O cadastro de clínicas está no PostgreSQL. Não depender de uma cópia no Drive.
    fromCanonical: (tabela: string) => (admin as any).from(tabela),
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
  if (!contexto.clinicaId) throw new Error("Selecione a clínica para salvar.");
  if ((contexto as { adminGeral?: boolean }).adminGeral) return; // Admin geral mantém a autorização da plataforma.
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
  if (!contexto.clinicaId) throw new Error("Clínica atual não identificada. Escolha uma clínica e tente novamente.");
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
  if (filtrarLeitura && !contexto.adminGeral && pares.some(([chave]) => permissoesDaChave(chave).length)) {
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
  if (!contexto.clinicaId) throw new Error("Clínica atual não identificada. Nenhuma gravação foi confirmada.");
  await validarAlteracoesPorPlano(data.accessToken, contexto, data.alteracoes);
  // A lista JSON legada também não pode adicionar animais acima da cota.
  // Compara IDs anteriores e novos; editar pacientes existentes continua permitido.
  for (const alteracao of data.alteracoes) {
    if (alteracao.chave !== "oricse-animais-v1" || alteracao.valor === null) continue;
    const lerIds = (json: string | undefined): string[] => {
      if (!json) return [];
      let dados: unknown;
      try { dados = JSON.parse(json); } catch { throw new Error("Lista de animais inválida."); }
      if (!Array.isArray(dados)) throw new Error("Lista de animais inválida.");
      return dados.map((animal: any) => String(animal?.id || "")).filter(Boolean);
    };
    const anteriores = lerIds(estado[alteracao.chave]);
    const atuais = lerIds(alteracao.valor);
    const anterioresSet = new Set(anteriores);
    const novos = atuais.filter((id) => !anterioresSet.has(id));
    if (novos.length && contexto.clinicaId) {
      const { validarCotaAnimaisClinica } = await import("@/lib/cota-animais.server");
      await validarCotaAnimaisClinica({
        clinicaId: contexto.clinicaId,
        existentes: anteriores,
        propostos: novos,
      });
    }
  }
  validarVersaoEstado(estado, data.alteracoes);
  for (const alteracao of data.alteracoes) {
    if (alteracao.valor === null) delete estado[alteracao.chave];
    else estado[alteracao.chave] = alteracao.valor;
  }
  const admin = await carregarAdmin();
  const { data: confirmado, error } = await admin.from("oricse_dados_modulos").upsert({
    clinica_id: contexto.clinicaId,
    chave: "estado_sistema",
    dados: estado,
    atualizado_por: contexto.userId,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: "clinica_id,chave" }).select("clinica_id,chave").single();
  if (error || !confirmado || confirmado.clinica_id !== contexto.clinicaId || confirmado.chave !== "estado_sistema") {
    throw new Error("O banco não confirmou a gravação: " + (error?.message || "resposta inconsistente") + ".");
  }
  return { ok: true, quantidade: Object.keys(estado).length };
}

export const salvarEstadoOricseDrive = createServerFn({ method: "POST" })
  .validator((input: unknown) => salvarSchema.parse(input))
  .handler(async ({ data }) => salvarEstadoOricseInterno(data));
