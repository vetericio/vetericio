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
    "oricse-modelos-documentos-v1": ["administracao.configuracoes"],
    "oricse-politicas-operacionais-v1": ["administracao.configuracoes"],
    "oricse-modulos-administrativos-v3": ["administracao.configuracoes"],
    "oricse-lgpd-solicitacoes-v1": ["administracao.configuracoes"],
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

async function autorizarModelosClinica(userId: string, clinicaId: string, adminGeral: boolean) {
  if (adminGeral) return;
  const admin = await carregarAdmin();
  const { data: vinculo, error } = await admin.from("clinica_usuarios")
    .select("papel").eq("user_id", userId).eq("clinica_id", clinicaId).eq("ativo", true).maybeSingle();
  if (error || !["rt", "admin_clinica"].includes(String(vinculo?.papel || ""))) {
    throw new Error("Somente o responsável técnico ou o administrador da clínica pode gerenciar modelos.");
  }
}

const politicasOperacionaisSchema = z.object({
  versao: z.literal(1),
  agenda: z.object({
    toleranciaMinutos: z.number().int().min(0).max(120),
    cancelamentoHoras: z.number().int().min(0).max(168),
    reagendamentoHoras: z.number().int().min(0).max(168),
    exigirSinal: z.boolean(),
    percentualSinal: z.number().int().min(0).max(100),
  }).strict(),
  aprovacoes: z.object({
    descontoAcimaPercentual: z.number().int().min(0).max(100),
    estornoExigeAprovacao: z.boolean(),
    exclusaoExigeAprovacao: z.boolean(),
  }).strict(),
  comunicacao: z.object({
    confirmacaoConsulta: z.string().max(1500),
    lembreteVacina: z.string().max(1500),
    mensagemRetorno: z.string().max(1500),
    mensagemPosConsulta: z.string().max(1500),
  }).strict(),
}).strict();

async function autorizarPoliticasClinica(userId: string, clinicaId: string, adminGeral: boolean) {
  if (adminGeral) return;
  const admin = await carregarAdmin();
  const { data: vinculo, error } = await admin.from("clinica_usuarios")
    .select("papel").eq("user_id", userId).eq("clinica_id", clinicaId).eq("ativo", true).maybeSingle();
  if (error || !["rt", "admin_clinica"].includes(String(vinculo?.papel || ""))) {
    throw new Error("Somente a administração ou o responsável técnico pode alterar as políticas da clínica.");
  }
}

const estruturaAdministrativaSchema = z.object({
  versao: z.literal(1),
  equipamentos: z.array(z.object({
    id: z.string().uuid(), nome: z.string().trim().min(2).max(100),
    setor: z.string().trim().min(2).max(80),
    patrimonio: z.string().max(80),
    proximaManutencao: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(["operante","manutencao","fora_de_uso"]),
    observacoes: z.string().max(600),
  }).strict()).max(250),
  pendencias: z.array(z.object({
    id: z.string().uuid(), titulo: z.string().trim().min(3).max(140),
    responsavel: z.string().max(100),
    prazo: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),
    prioridade: z.enum(["baixa","media","alta"]),
    status: z.enum(["aberta","em_andamento","concluida"]),
    observacoes: z.string().max(800),
  }).strict()).max(400),
  especies: z.array(z.object({
    id: z.string().uuid(), nome: z.string().trim().min(2).max(80),
    instrucoes: z.string().max(1400),
  }).strict()).max(100),
  contingencia: z.object({
    responsavel: z.string().max(100),
    telefone: z.string().max(60),
    orientacoes: z.string().max(4000),
    ultimaRevisao: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),
  }).strict(),
  indicadores: z.object({
    consultas: z.boolean(), exames: z.boolean(), internacao: z.boolean(),
    hotel: z.boolean(), banhoTosa: z.boolean(), vendaExpressa: z.boolean(),
    receita: z.boolean(), despesas: z.boolean(),
  }).strict(),
}).strict();

async function autorizarAdministracaoClinica(userId: string, clinicaId: string, adminGeral: boolean) {
  if (adminGeral) return;
  const admin = await carregarAdmin();
  const { data: vinculo, error } = await admin.from("clinica_usuarios")
    .select("papel").eq("user_id", userId).eq("clinica_id", clinicaId).eq("ativo", true).maybeSingle();
  if (error || !["rt","admin_clinica"].includes(String(vinculo?.papel || ""))) {
    throw new Error("Somente administradores da clínica e RTs podem alterar estes módulos.");
  }
}

const lgpdSolicitacoesSchema = z.object({
  versao:z.literal(1),
  solicitacoes:z.array(z.object({
    id:z.string().uuid(),
    protocolo:z.string().min(3).max(64),
    tipo:z.enum(["acesso","correcao","exclusao","portabilidade","revogacao","outros"]),
    titularReferencia:z.string().min(2).max(120),
    recebidoEm:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    prazo:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),
    status:z.enum(["recebida","em_analise","respondida","encerrada"]),
    responsavel:z.string().max(100),
    descricao:z.string().max(1400),
    registroResposta:z.string().max(1400),
    resolvidoEm:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),
  }).strict()).max(500),
}).strict();

async function validarAlteracoesPorPlano(
  accessToken: string,
  contexto: { userId: string; clinicaId: string | null },
  alteracoes: Array<{ chave: string }>,
) {
  if (!contexto.clinicaId) throw new Error("Selecione a clínica para salvar.");
  if (alteracoes.some((item) => item.chave === "oricse-modelos-documentos-v1")) {
    await autorizarModelosClinica(contexto.userId, contexto.clinicaId, Boolean((contexto as { adminGeral?: boolean }).adminGeral));
  }
  for (const item of alteracoes) {
    if (item.chave !== "oricse-politicas-operacionais-v1") continue;
    await autorizarPoliticasClinica(contexto.userId, contexto.clinicaId, Boolean((contexto as { adminGeral?: boolean }).adminGeral));
  }
  if (alteracoes.some(item=>item.chave==="oricse-lgpd-solicitacoes-v1")) {
    await autorizarAdministracaoClinica(contexto.userId, contexto.clinicaId, Boolean((contexto as {adminGeral?:boolean}).adminGeral));
  }
  if (alteracoes.some((item) => item.chave === "oricse-modulos-administrativos-v3")) {
    await autorizarAdministracaoClinica(contexto.userId, contexto.clinicaId, Boolean((contexto as {adminGeral?:boolean}).adminGeral));
  }
  if ((contexto as { adminGeral?: boolean }).adminGeral) return; // Admin geral mantém a autorização da plataforma.
  const regras = new Map<string, string[]>();
  for (const item of alteracoes) {
    if (item.chave === "oricse-lgpd-solicitacoes-v1") continue;
    if (item.chave === "oricse-modulos-administrativos-v3") continue; // Admin/RT checado acima.
    if (item.chave === "oricse-politicas-operacionais-v1") continue; // Regra estrita Admin/RT.
    if (item.chave === "oricse-modelos-documentos-v1") continue; // Autorização estrita Admin/RT verificada acima.
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
  if (filtrarLeitura && !contexto.adminGeral) {
    const autorizado = await (async () => {
      try { await autorizarModelosClinica(contexto.userId, contexto.clinicaId!, false); return true; }
      catch { return false; }
    })();
    if (!autorizado) delete estado["oricse-modelos-documentos-v1"];
    const politicasPermitidas = await (async () => {
      try { await autorizarPoliticasClinica(contexto.userId, contexto.clinicaId!, false); return true; }
      catch { return false; }
    })();
    if (!politicasPermitidas) delete estado["oricse-politicas-operacionais-v1"];
    const permitidoAdmin = await (async () => {
      try { await autorizarAdministracaoClinica(contexto.userId, contexto.clinicaId!, false); return true; }
      catch { return false; }
    })();
    if (!permitidoAdmin) delete estado["oricse-modulos-administrativos-v3"];
    if (!permitidoAdmin) delete estado["oricse-lgpd-solicitacoes-v1"];
  }
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
  for (const alteracao of data.alteracoes) {
    if (alteracao.chave !== "oricse-politicas-operacionais-v1") continue;
    if (alteracao.valor === null || alteracao.valor.length > 12000) throw new Error("Políticas operacionais inválidas.");
    let parsed: unknown;
    try { parsed = JSON.parse(alteracao.valor); } catch { throw new Error("JSON das políticas inválido."); }
    politicasOperacionaisSchema.parse(parsed);
  }
  for (const alteracao of data.alteracoes) {
    if (alteracao.chave !== "oricse-modulos-administrativos-v3") continue;
    if (alteracao.valor === null || alteracao.valor.length > 300000) throw new Error("Configurações administrativas inválidas.");
    let parsed: unknown;
    try { parsed = JSON.parse(alteracao.valor); } catch { throw new Error("JSON administrativo inválido."); }
    estruturaAdministrativaSchema.parse(parsed);
  }
  for (const alteracao of data.alteracoes) {
    if (alteracao.chave !== "oricse-lgpd-solicitacoes-v1") continue;
    if (alteracao.valor === null || alteracao.valor.length > 650000) throw new Error("Solicitações LGPD inválidas.");
    let parsed: unknown;
    try { parsed=JSON.parse(alteracao.valor); } catch { throw new Error("JSON de solicitações LGPD inválido."); }
    lgpdSolicitacoesSchema.parse(parsed);
  }
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


const modelosClinicosSchema = inputSchema.extend({
  clinicaId: z.string().uuid(),
});

/** Lista somente os modelos da clínica autenticada, sem revelar o estado completo dos módulos. */
export const listarModelosClinicos = createServerFn({ method: "POST" })
  .validator((input: unknown) => modelosClinicosSchema.parse(input))
  .handler(async ({ data }) => {
    const contexto = await contextoUsuario(data.accessToken);
    if (contexto.clinicaId !== data.clinicaId) {
      throw new Error("O atendimento não pertence à clínica selecionada.");
    }
    if (!contexto.adminGeral) {
      const permitidas = await obterPermissoesUsuario(data.accessToken, contexto);
      if (!permitidas.has("consultorio.receituario") && !permitidas.has("consultorio.atendimentos")) {
        throw new Error("Seu perfil não tem permissão para utilizar documentos clínicos.");
      }
    }
    const { estado } = await lerEstado(data.accessToken);
    let valores: unknown;
    try { valores = JSON.parse(estado["oricse-modelos-documentos-v1"] || "[]"); }
    catch { throw new Error("A biblioteca da clínica está inconsistente. Solicite revisão à administração."); }
    if (!Array.isArray(valores)) throw new Error("Biblioteca de modelos inválida.");
    return valores.filter((modelo): modelo is { id: string; nome: string; categoria: string; texto: string; versao: number } => Boolean(
      modelo && typeof modelo === "object" &&
      typeof modelo.id === "string" && typeof modelo.nome === "string" &&
      typeof modelo.texto === "string" && modelo.texto.length <= 25000 &&
      ["receita", "pedido", "documento", "termo"].includes(modelo.categoria)
    )).slice(0, 80).map((modelo) => ({
      id: modelo.id, nome: modelo.nome, categoria: modelo.categoria,
      texto: modelo.texto, versao: Number(modelo.versao) || 0,
    }));
  });
