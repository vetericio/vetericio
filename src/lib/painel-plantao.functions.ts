import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  FUSO_PLANTAO,
  programarPlantao,
  turnoDoPainel,
  type EventoPlantao,
  type PainelPlantao,
} from "./painel-plantao";
import type { Registro } from "./ficha";

const contextoSchema = z.object({
  accessToken: z.string().min(20).max(8192),
  clinicaId: z.string().uuid(),
});
const texto = z.string().trim().max(1000);
const entradaEvento = contextoSchema.extend({
  turno: z.string().min(3).max(80),
  evento: z.discriminatedUnion("tipo", [
    z.object({
      tipo: z.literal("dose"),
      chave: z.string().regex(/^[a-f\d]{64}:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      estado: z.enum(["realizada", "nao_realizada"]),
      revisouHistorico: z.boolean().optional(),
      texto,
    }),
    z.object({
      tipo: z.literal("ocorrencia"),
      chave: z.string().uuid(),
      registroId: z.string().min(1).max(300),
      texto: texto.min(1),
    }),
    z.object({ tipo: z.literal("passagem"), chave: z.string().uuid(), texto: texto.min(1) }),
  ]),
});
type Contexto = z.infer<typeof contextoSchema>;

async function autorizado({ clinicaId, accessToken }: Contexto, fechamento = false) {
  const [{ supabaseAdmin }, { clienteSupabaseUsuario, exigirPermissaoClinica }] = await Promise.all(
    [import("@/integrations/supabase/client.server"), import("@/lib/permissao-clinica.server")],
  );
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Sessão inválida ou expirada.");
  const uid = data.user.id;
  const usuario = clienteSupabaseUsuario(accessToken);
  const { data: atual, error: erroAtual } = await usuario.rpc("oricse_contexto_clinica_atual");
  if (erroAtual || atual?.[0]?.clinica_id !== clinicaId)
    throw new Error("Selecione a clínica ativa para abrir o plantão.");
  // A agenda continua sob internacao.medicacoes; a fonte da ficha legada
  // exige internacao.registrar (mapeamento de chaves em oricse-storage.functions).
  await Promise.all([
    exigirPermissaoClinica(
      supabaseAdmin,
      uid,
      clinicaId,
      fechamento ? ["internacao.plantoes"] : ["internacao.medicacoes"],
      accessToken,
    ),
    exigirPermissaoClinica(supabaseAdmin, uid, clinicaId, ["internacao.registrar"], accessToken),
  ]);
  return { admin: supabaseAdmin, uid };
}
type Admin = Awaited<ReturnType<typeof autorizado>>["admin"];

function parsePersistido(valor: string | null | undefined): unknown {
  if (valor == null) return null;
  try {
    return JSON.parse(valor);
  } catch {
    throw new Error("Não foi possível interpretar a ficha persistida deste plantão.");
  }
}

async function lerFonte(admin: Admin, clinicaId: string) {
  const { data, error } = await admin
    .from("oricse_dados_modulos")
    .select("turno:dados->>veterico-plantao-v1,registros:dados->>veterico-registros-v1")
    .eq("clinica_id", clinicaId)
    .eq("chave", "estado_sistema")
    .maybeSingle()
    .overrideTypes<{ turno: string | null; registros: string | null }, { merge: false }>();
  if (error) throw new Error("Não foi possível consultar a escala da internação.");
  const turno = turnoDoPainel(parsePersistido(data?.turno));
  const registros = parsePersistido(data?.registros);
  if (registros !== null && !Array.isArray(registros))
    throw new Error("A lista de internação persistida está inválida.");
  if (Array.isArray(registros) && registros.length > 500)
    throw new Error("Painel excedeu o limite de fichas. Confira a lista da internação.");
  return { turno, registros: (registros ?? []) as Registro[] };
}

const tabela = "oricse_painel_plantao_eventos";
const campos =
  "chave,turno_chave,tipo,registro_id,paciente,medicamento,agendado_em,estado,texto,autor_nome,registrado_em";
async function eventosTurno(admin: Admin, clinicaId: string, turno: string) {
  const eventos: EventoPlantao[] = [];
  for (let i = 0; i < 5000; i += 500) {
    const { data, error } = await admin
      .from(tabela)
      .select(campos)
      .eq("clinica_id", clinicaId)
      .eq("turno_chave", turno)
      .order("registrado_em", { ascending: false })
      .order("tipo")
      .order("chave")
      .range(i, i + 499)
      .overrideTypes<EventoPlantao[], { merge: false }>();
    if (error || !data)
      throw new Error("Não foi possível consultar os registros de execução do plantão.");
    eventos.push(...data);
    if (data.length < 500) return eventos;
  }
  throw new Error("Este plantão excedeu o limite de registros que o painel pode exibir.");
}

async function ultimasPassagens(admin: Admin, clinicaId: string, turno?: string) {
  let consulta = admin
    .from(tabela)
    .select(campos)
    .eq("clinica_id", clinicaId)
    .eq("tipo", "passagem");
  if (turno) consulta = consulta.neq("turno_chave", turno);
  const { data, error } = await consulta
    .order("registrado_em", { ascending: false })
    .order("chave")
    .limit(3)
    .overrideTypes<EventoPlantao[], { merge: false }>();
  if (error || !data)
    throw new Error("Não foi possível consultar as últimas passagens de plantão.");
  return data;
}

/** Só devolve execuções de outro turno para ocorrências presentes na grade. */
async function execucoesAnteriores(
  admin: Admin,
  clinicaId: string,
  turno: string,
  doses: { chave: string; horario: string }[],
  agora: string,
) {
  const chaves = new Set(doses.filter((d) => d.horario <= agora).map((d) => d.chave));
  if (!chaves.size) return [];
  const inicio = doses[0].horario;
  const eventos: EventoPlantao[] = [];
  for (let i = 0; i < 5000; i += 500) {
    const { data, error } = await admin
      .from(tabela)
      .select(campos)
      .eq("clinica_id", clinicaId)
      .eq("tipo", "dose")
      .neq("turno_chave", turno)
      .gte("agendado_em", inicio)
      .lte("agendado_em", agora)
      .order("agendado_em")
      .order("chave")
      .range(i, i + 499)
      .overrideTypes<EventoPlantao[], { merge: false }>();
    if (error || !data)
      throw new Error("Não foi possível conferir as execuções de plantões anteriores.");
    eventos.push(...data.filter((e) => chaves.has(e.chave)));
    if (data.length < 500) return eventos;
  }
  throw new Error("Há execuções anteriores demais para conferir com segurança.");
}

export const consultarPainelPlantao = createServerFn({ method: "POST" })
  .validator((entrada: unknown) => contextoSchema.parse(entrada))
  .handler(async ({ data }): Promise<PainelPlantao> => {
    const { admin } = await autorizado(data);
    const { turno, registros } = await lerFonte(admin, data.clinicaId);
    const agora = new Date().toISOString();
    const [eventos, passagens, escala] = await Promise.all([
      turno ? eventosTurno(admin, data.clinicaId, turno.chave) : Promise.resolve([]),
      ultimasPassagens(admin, data.clinicaId, turno?.chave),
      turno
        ? programarPlantao(registros, turno, Date.parse(agora))
        : Promise.resolve({ pacientes: [], doses: [], semProgramacao: 0, programacoesLegadas: 0 }),
    ]);
    const execucoes = turno
      ? await execucoesAnteriores(admin, data.clinicaId, turno.chave, escala.doses, agora)
      : [];
    return {
      ...escala,
      agora,
      turno: turno ? { chave: turno.chave, dia: turno.dia, turno: turno.turno } : null,
      eventos: [...eventos, ...execucoes, ...passagens],
    };
  });

export const registrarEventoPlantao = createServerFn({ method: "POST" })
  .validator((entrada: unknown) => entradaEvento.parse(entrada))
  .handler(async ({ data }): Promise<EventoPlantao> => {
    const { admin, uid } = await autorizado(data);
    const evento = data.evento;
    if (evento.tipo === "dose" && evento.estado === "nao_realizada" && !evento.texto)
      throw new Error("Descreva por que a execução não foi realizada.");
    // O cliente nunca pode informar autor, paciente nominal, horário ou medicamento.
    const { turno, registros } = await lerFonte(admin, data.clinicaId);
    if (!turno || turno.chave !== data.turno)
      throw new Error("O plantão mudou. Atualize o painel antes de registrar.");
    const agora = Date.now();
    const escala = evento.tipo === "dose" ? await programarPlantao(registros, turno, agora) : null;
    const dose =
      evento.tipo === "dose" ? escala?.doses.find((d) => d.chave === evento.chave) : undefined;
    if (evento.tipo === "dose" && (!dose?.confirmada || Date.parse(dose.horario) > agora)) {
      throw new Error(
        `Horário futuro ou programação alterada. Atualize a agenda (${FUSO_PLANTAO}).`,
      );
    }
    const consultaAnterior = () => {
      let consulta = admin
        .from(tabela)
        .select(campos)
        .eq("clinica_id", data.clinicaId)
        .eq("tipo", evento.tipo)
        .eq("chave", evento.chave);
      if (evento.tipo !== "dose") consulta = consulta.eq("turno_chave", turno.chave);
      return consulta.maybeSingle().overrideTypes<EventoPlantao, { merge: false }>();
    };
    const anterior = await consultaAnterior();
    if (anterior.error) throw new Error("Não foi possível verificar a execução anterior.");
    if (anterior.data) return anterior.data;
    if (evento.tipo === "dose" && dose?.historicoLegadoSemVinculo && !evento.revisouHistorico) {
      throw new Error(
        "Há um registro antigo sem vínculo com este horário. Confira a ficha e confirme a revisão.",
      );
    }

    const paciente =
      evento.tipo === "ocorrencia"
        ? registros.find(
            (r) =>
              r?.id === evento.registroId &&
              !r.obito &&
              typeof r.animal === "string" &&
              r.animal.trim(),
          )
        : undefined;
    if (evento.tipo === "ocorrencia" && !paciente)
      throw new Error("Paciente fora do painel deste plantão.");
    const { data: perfil, error: erroPerfil } = await admin
      .from("oricse_pessoas")
      .select("nome_completo")
      .eq("user_id", uid)
      .maybeSingle();
    if (erroPerfil) throw new Error("Não foi possível confirmar o seu perfil profissional.");
    const autor =
      typeof perfil?.nome_completo === "string" ? perfil.nome_completo.trim().slice(0, 220) : "";
    if (!autor)
      throw new Error("Preencha seu nome completo em Meus dados antes de registrar uma execução.");
    const { data: salvo, error } = await admin
      .from(tabela)
      .insert({
        clinica_id: data.clinicaId,
        turno_chave: turno.chave,
        chave: evento.chave,
        tipo: evento.tipo,
        registro_id: dose?.registroId ?? paciente?.id ?? null,
        paciente: dose?.paciente ?? paciente?.animal.trim().slice(0, 300) ?? null,
        medicamento: dose?.medicamento ?? null,
        agendado_em: dose?.horario ?? null,
        estado: evento.tipo === "dose" ? evento.estado : null,
        texto: evento.texto,
        autor_id: uid,
        autor_nome: autor,
      })
      .select(campos)
      .single()
      .overrideTypes<EventoPlantao, { merge: false }>();
    if (!error && salvo) return salvo;
    if (error?.code === "23505") {
      const existente = await consultaAnterior();
      if (!existente.error && existente.data) return existente.data;
    }
    throw new Error(
      "O servidor não confirmou o registro do plantão. Atualize a tela antes de tentar de novo.",
    );
  });

const chavesFechamento = [
  "veterico-plantao-v1",
  "veterico-registros-v1",
  "veterico-curvas-v1",
  "veterico-anamneses",
  "veterico-plantoes-v1",
  "veterico-bloco-notas",
] as const;
export const fecharPlantaoComHistorico = createServerFn({ method: "POST" })
  .validator((entrada: unknown) =>
    contextoSchema.extend({ turno: z.string().min(3).max(80) }).parse(entrada),
  )
  .handler(async ({ data }) => {
    const { admin, uid } = await autorizado(data, true);
    const { data: anterior, error: falhaAnterior } = await admin
      .from("oricse_fechamentos_plantao" as never)
      .select("turno_chave")
      .eq("clinica_id", data.clinicaId)
      .eq("turno_chave", data.turno)
      .maybeSingle();
    if (falhaAnterior) throw new Error("Não foi possível consultar o histórico do turno.");
    if (anterior) return { ok: true as const };
    const { data: estado, error: erro } = await admin
      .from("oricse_dados_modulos")
      .select("dados")
      .eq("clinica_id", data.clinicaId)
      .eq("chave", "estado_sistema")
      .maybeSingle();
    if (erro || !estado?.dados || typeof estado.dados !== "object" || Array.isArray(estado.dados)) {
      throw new Error("Não foi possível confirmar o turno. Nenhum dado foi encerrado.");
    }
    const dados = estado.dados as Record<string, unknown>;
    const leitura = Object.fromEntries(
      chavesFechamento.map((chave) => [chave, dados[chave] ?? null]),
    );
    const ler = (chave: (typeof chavesFechamento)[number]) => {
      const valor = leitura[chave];
      if (valor !== null && typeof valor !== "string")
        throw new Error("Estado de internação inválido.");
      return parsePersistido(valor);
    };
    const lista = (chave: (typeof chavesFechamento)[number]) => {
      const itens = ler(chave);
      if (itens == null) return [];
      if (!Array.isArray(itens))
        throw new Error("O arquivo da internação está inválido. Nenhum dado foi encerrado.");
      return itens;
    };
    const turno = turnoDoPainel(ler("veterico-plantao-v1"));
    if (!turno || turno.chave !== data.turno)
      throw new Error("O plantão mudou. Atualize antes de fechar.");
    const arquivo = {
      id: turno.chave,
      data: turno.dia,
      turno: turno.turno,
      turnoChave: turno.chave,
      registros: lista("veterico-registros-v1"),
      curvas: lista("veterico-curvas-v1"),
      anamneses: lista("veterico-anamneses"),
      notas:
        typeof leitura["veterico-bloco-notas"] === "string"
          ? leitura["veterico-bloco-notas"]
          : null,
    };
    const { data: salvo, error } = await admin.rpc(
      "oricse_encerrar_plantao_atomicamente" as never,
      {
        p_clinica: data.clinicaId,
        p_autor: uid,
        p_turno: turno.chave,
        p_leitura: leitura,
        p_arquivo: arquivo,
      } as never,
    );
    if (error?.code === "40001") throw new Error(error.message);
    if (error || salvo !== true)
      throw new Error(
        "O banco não confirmou o fechamento. O plantão não foi descartado. Confira no histórico antes de tentar novamente.",
      );
    return { ok: true as const };
  });
