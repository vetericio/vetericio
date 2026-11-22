import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissaoClinica } from "@/lib/permissao-clinica.server";
import { comporMensagemAcompanhamento } from "@/lib/crm-mensagem-local";

export type StatusRetorno = "a_confirmar" | "contatado" | "confirmado" | "reagendar" | "realizado" | "cancelado";
export type TipoRetorno = "consulta" | "vacina" | "vermifugo" | "exame" | "cirurgia" | "medicacao" | "manual" | "outro";

export type RetornoClinico = {
  id: string; animal_id: string; tutor_id: string; origem: TipoRetorno; titulo: string;
  data_prevista: string | null; orientacoes: string; status: StatusRetorno;
  anotacao_equipe: string; contato_em: string | null; confirmado_em: string | null;
  realizado_em: string | null; animal_nome: string; tutor_nome: string;
  telefone: string; email: string; permite_whatsapp: boolean; permite_email: boolean;
};

const base = z.object({
  accessToken: z.string().min(20),
  clinicaId: z.string().uuid(),
});

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine((d) => !Number.isNaN(Date.parse(d)) && new Date(d + "T12:00:00Z").toISOString().startsWith(d),
    "A data informada não existe.");

const escrever = base.extend({
  animalId: z.string().uuid(),
  origem: z.enum(["consulta","manual"]),
  origemId: z.string().uuid().optional(),
  titulo: z.string().trim().min(3).max(180),
  orientacoes: z.string().trim().max(2000).default(""),
  dataPrevista: dataISO.optional().nullable(),
});

const alterar = base.extend({
  id: z.string().uuid(),
  status: z.enum(["a_confirmar","contatado","confirmado","reagendar","realizado","cancelado"]),
  dataPrevista: dataISO.optional(),
  observacao: z.string().trim().max(2000).default(""),
});

async function acessoSeguro(accessToken: string, clinicaId: string, operacao: "consultorio" | "gestao" | "leitura") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: auth, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !auth.user) throw new Error("Sessão expirada. Entre novamente.");
  const codigos = operacao === "consultorio"
    ? ["consultorio.atendimentos"]
    : operacao === "gestao"
      ? ["crm.gerenciar", "crm.enviar", "recepcao.agenda"]
      : ["crm.visualizar", "crm.gerenciar", "crm.enviar", "recepcao.agenda", "consultorio.atendimentos"];
  await exigirPermissaoClinica(supabaseAdmin, auth.user.id, clinicaId, codigos, accessToken);
  return { admin: supabaseAdmin, userId: auth.user.id };
}

type Fonte = { id: string; animal_id: string; nome?: string | null; titulo?: string | null; data: string | null };
async function obterTodasLinhas(admin: any, tabela: string, colunas: string, clinicaId: string, dataColuna: string) {
  const resultado: Fonte[] = [];
  for (let deslocamento = 0; deslocamento < 5000; deslocamento += 500) {
    const { data, error } = await admin.from(tabela).select(colunas)
      .eq("clinica_id", clinicaId).not(dataColuna, "is", null)
      .order("id").range(deslocamento, deslocamento + 499);
    if (error) throw new Error("Não foi possível consultar os reforços clínicos.");
    const itens = data || [];
    resultado.push(...itens.map((item: any) => ({
      id: item.id, animal_id: item.animal_id, nome: item.nome,
      titulo: item.titulo, data: item[dataColuna],
    })));
    if (itens.length < 500) break;
  }
  return resultado;
}

/** Reconciliação: nunca inventa intervalos clínicos nem envia mensagens. */
async function sincronizarReforcos(admin: any, clinicaId: string) {
  const [vacinas, vermifugos, exames, animais, existentes] = await Promise.all([
    obterTodasLinhas(admin, "oricse_portal_vacinas", "id,animal_id,nome,reforco_em", clinicaId, "reforco_em"),
    obterTodasLinhas(admin, "oricse_portal_vermifugos", "id,animal_id,nome,proxima_dose_em", clinicaId, "proxima_dose_em"),
    obterTodasLinhas(admin, "oricse_portal_exames", "id,animal_id,titulo,retorno_em", clinicaId, "retorno_em"),
    admin.from("oricse_animais").select("id,tutor_id").eq("clinica_id", clinicaId).limit(5000),
    admin.from("oricse_crm_retornos").select("origem,origem_id").eq("clinica_id", clinicaId)
      .not("origem_id","is",null).limit(5000),
  ]);
  if (animais.error || existentes.error) throw new Error("Não foi possível conciliar os retornos.");
  const tutores = new Map((animais.data || []).map((animal: {id:string;tutor_id:string}) => [animal.id, animal.tutor_id]));
  const chaves = new Set((existentes.data || []).map((item: {origem:string;origem_id:string}) => item.origem + ":" + item.origem_id));
  const novos: Record<string, unknown>[] = [];
  const adicionar = (origem: TipoRetorno, fontes: Fonte[], nome: string) => {
    for (const fonte of fontes) {
      const tutorId = tutores.get(fonte.animal_id);
      const chave = origem + ":" + fonte.id;
      if (!tutorId || !fonte.data || chaves.has(chave)) continue;
      novos.push({
        clinica_id: clinicaId, animal_id: fonte.animal_id, tutor_id: tutorId,
        origem, origem_id: fonte.id, data_prevista: fonte.data,
        titulo: nome + (fonte.nome || fonte.titulo ? ": " + (fonte.nome || fonte.titulo) : ""),
        orientacoes: "Confirmar com o tutor a data indicada no registro clínico.",
        status: "a_confirmar",
      });
      chaves.add(chave);
    }
  };
  adicionar("vacina", vacinas, "Reforço de vacina");
  adicionar("vermifugo", vermifugos, "Próxima vermifugação");
  adicionar("exame", exames, "Retorno de exame");
  for (let i = 0; i < novos.length; i += 100) {
    const { error } = await admin.from("oricse_crm_retornos")
      .upsert(novos.slice(i,i+100), {
        onConflict: "clinica_id,origem,origem_id", ignoreDuplicates: true,
      });
    if (error) throw new Error("Não foi possível atualizar a fila de reforços.");
  }
}

export const listarRetornosClinica = createServerFn({ method: "POST" })
  .validator((input: unknown) => base.extend({ sincronizar: z.boolean().optional() }).parse(input))
  .handler(async ({ data }) => {
    const { admin } = await acessoSeguro(data.accessToken, data.clinicaId, "leitura");
    // A fila deve poder carregar sem aguardar a varredura de todas as vacinas,
    // vermífugos e exames. A reconciliação será solicitada separadamente
    // pela interface depois da primeira renderização.
    if (data.sincronizar) await sincronizarReforcos(admin, data.clinicaId);
    const [retornos, animais, tutores] = await Promise.all([
      admin.from("oricse_crm_retornos").select("id,animal_id,tutor_id,origem,titulo,data_prevista,orientacoes,status,anotacao_equipe,contato_em,confirmado_em,realizado_em")
        .eq("clinica_id", data.clinicaId).order("data_prevista", { ascending: true }).limit(2000),
      admin.from("oricse_animais").select("id,nome,tutor_id").eq("clinica_id", data.clinicaId).limit(5000),
      admin.from("tutores").select("id,nome,telefone,outro_telefone,email,dados").eq("clinica_id", data.clinicaId).limit(5000),
    ]);
    if (retornos.error || animais.error || tutores.error)
      throw new Error("Não foi possível carregar os retornos desta clínica.");
    const pets = new Map((animais.data || []).map((a: any) => [a.id, a]));
    const pais = new Map((tutores.data || []).map((t: any) => [t.id, t]));
    return (retornos.data || []).map((r: any) => {
      const pet: any = pets.get(r.animal_id);
      const tutor: any = pais.get(r.tutor_id);
      if (!pet || !tutor || pet.tutor_id !== r.tutor_id) return null;
      const autorizaLembretes = tutor.dados?.autorizaLembretes === true;
      return {
        ...r,
        animal_nome: pet.nome || "Paciente",
        tutor_nome: tutor.nome || "Responsável",
        telefone: tutor.telefone || tutor.outro_telefone || "",
        email: tutor.email || "",
        permite_whatsapp: autorizaLembretes && tutor.dados?.autorizaWhatsapp === true,
        permite_email: autorizaLembretes && tutor.dados?.autorizaEmail === true,
      } as RetornoClinico;
    }).filter((r: RetornoClinico | null): r is RetornoClinico => Boolean(r));
  });

export const registrarRetornoClinico = createServerFn({ method: "POST" })
  .validator((input: unknown) => escrever.parse(input))
  .handler(async ({ data }) => {
    const { admin, userId } = await acessoSeguro(
      data.accessToken, data.clinicaId, data.origem === "consulta" ? "consultorio" : "gestao");
    if (data.origem === "consulta" && !data.origemId)
      throw new Error("Identificação da consulta inválida.");
    const { data: animal, error: erroAnimal } = await admin.from("oricse_animais")
      .select("id,tutor_id").eq("clinica_id", data.clinicaId)
      .eq("id", data.animalId).maybeSingle();
    if (erroAnimal || !animal) throw new Error("Paciente não pertence à clínica informada.");
    if (data.origem === "consulta") {
      const { data: registro, error } = await admin.from("oricse_animal_registros_extra")
        .select("id").eq("id", data.origemId).eq("clinica_id", data.clinicaId)
        .eq("animal_id", data.animalId).eq("titulo","Consulta").maybeSingle();
      if (error || !registro) throw new Error("Salve primeiro a consulta no prontuário.");
    }
    // Retornos manuais são independentes: o ID do animal nunca deve ser usado
    // como chave única de retorno. A idempotência aplica-se apenas à consulta.
    const origemIdConsulta = data.origem === "consulta" ? data.origemId : undefined;
    const payload = {
      clinica_id: data.clinicaId, animal_id: data.animalId, tutor_id: animal.tutor_id,
      origem: data.origem, origem_id: origemIdConsulta || null,
      titulo: data.titulo, orientacoes: data.orientacoes,
      data_prevista: data.dataPrevista, status: "a_confirmar",
      criado_por: userId, atualizado_por: userId,
    };
    if (origemIdConsulta) {
      const { data: registroExistente, error: erroConsulta } = await admin
        .from("oricse_crm_retornos").select("id")
        .eq("clinica_id", data.clinicaId).eq("origem", data.origem)
        .eq("origem_id", origemIdConsulta).maybeSingle();
      if (erroConsulta) throw new Error("Não foi possível verificar o retorno.");
      if (registroExistente) return { id: registroExistente.id as string, criado: false };
    }
    const { data: criado, error } = await admin.from("oricse_crm_retornos")
      .insert(payload).select("id").single();
    if (error || !criado) {
      if (error?.code === "23505" && origemIdConsulta) {
        const { data: existente } = await admin.from("oricse_crm_retornos").select("id")
          .eq("clinica_id",data.clinicaId).eq("origem",data.origem)
          .eq("origem_id",origemIdConsulta).maybeSingle();
        if (existente?.id) return { id: existente.id as string, criado: false };
      }
      throw new Error("Consulta salva, mas o retorno não foi cadastrado. Registre-o na Central de Relacionamento.");
    }
    return { id: criado.id as string, criado: true };
  });

export const atualizarRetornoClinico = createServerFn({ method: "POST" })
  .validator((input: unknown) => alterar.parse(input))
  .handler(async ({ data }) => {
    const { admin, userId } = await acessoSeguro(data.accessToken, data.clinicaId, "gestao");
    if (data.status === "reagendar" && !data.dataPrevista)
      throw new Error("Selecione a nova data para reagendar.");
    const hoje = new Date().toISOString();
    const campos: Record<string, unknown> = {
      status: data.status, anotacao_equipe: data.observacao, atualizado_por: userId,
      updated_at: hoje,
    };
    if (data.dataPrevista) campos.data_prevista = data.dataPrevista;
    if (data.status === "contatado") campos.contato_em = hoje;
    if (data.status === "confirmado") campos.confirmado_em = hoje;
    if (data.status === "realizado") campos.realizado_em = hoje;
    const { data: salvo, error } = await admin.from("oricse_crm_retornos")
      .update(campos).eq("clinica_id",data.clinicaId).eq("id",data.id)
      .select("id,status").maybeSingle();
    if (error || !salvo) throw new Error("Não foi possível atualizar o retorno desta clínica.");
    return { id: salvo.id as string, status: salvo.status as StatusRetorno };
  });

/**
 * Prévia local para contato humano: não salva o texto e não envia WhatsApp.
 * Consulta somente o prontuário do paciente da mesma clínica, com permissão de CRM.
 */
export const prepararMensagemAcompanhamento = createServerFn({ method: "POST" })
  .validator((input: unknown) => base.extend({ retornoId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { admin } = await acessoSeguro(data.accessToken, data.clinicaId, "gestao");
    const { data: retorno, error: erroRetorno } = await admin.from("oricse_crm_retornos")
      .select("id,animal_id,tutor_id,origem,origem_id")
      .eq("clinica_id", data.clinicaId).eq("id", data.retornoId).maybeSingle();
    if (erroRetorno || !retorno) throw new Error("Retorno não encontrado nesta clínica.");

    const [animalResp, tutorResp] = await Promise.all([
      admin.from("oricse_animais").select("id,nome,tutor_id")
        .eq("clinica_id", data.clinicaId).eq("id", retorno.animal_id).maybeSingle(),
      admin.from("tutores").select("id,nome,telefone,outro_telefone,dados")
        .eq("clinica_id", data.clinicaId).eq("id", retorno.tutor_id).maybeSingle(),
    ]);
    const animal = animalResp.data;
    const tutor = tutorResp.data;
    if (animalResp.error || tutorResp.error || !animal || !tutor || animal.tutor_id !== tutor.id) {
      throw new Error("Não foi possível conferir o vínculo entre tutor e paciente.");
    }
    const autorizado = tutor.dados?.autorizaLembretes === true && tutor.dados?.autorizaWhatsapp === true;
    if (!autorizado) throw new Error("O tutor não autorizou lembretes por WhatsApp.");
    const telefone = String(tutor.telefone || tutor.outro_telefone || "").replace(/\D/g, "");
    const numero = telefone.length >= 10 && telefone.length <= 11 ? "55" + telefone : telefone;
    if (!/^\d{12,13}$/.test(numero) || !numero.startsWith("55")) {
      throw new Error("O tutor não possui um WhatsApp válido cadastrado.");
    }

    // Usa o registro associado à consulta, se houver; caso contrário, a última consulta da ficha.
    let consulta: any = null;
    if (retorno.origem === "consulta" && retorno.origem_id) {
      const exata = await admin.from("oricse_animal_registros_extra")
        .select("id,data,detalhe,dados_atendimento")
        .eq("clinica_id", data.clinicaId).eq("animal_id", animal.id)
        .eq("id", retorno.origem_id).eq("titulo", "Consulta").maybeSingle();
      if (exata.error) throw new Error("Não foi possível consultar o atendimento.");
      consulta = exata.data;
    }
    if (!consulta) {
      const recente = await admin.from("oricse_animal_registros_extra")
        .select("id,data,detalhe,dados_atendimento")
        .eq("clinica_id", data.clinicaId).eq("animal_id", animal.id)
        .eq("titulo", "Consulta").order("data", { ascending: false })
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (recente.error) throw new Error("Não foi possível consultar o atendimento.");
      consulta = recente.data;
    }
    const dadosConsulta = consulta?.dados_atendimento || {};
    const queixa = typeof dadosConsulta.consulta?.queixa === "string"
      ? dadosConsulta.consulta.queixa
      : String(consulta?.detalhe || "").match(/(?:^|\n)Queixa principal:\s*([^\n]+)/i)?.[1] || "";
    const autorNome = typeof dadosConsulta.autorNome === "string" ? dadosConsulta.autorNome : "";
    return {
      mensagem: comporMensagemAcompanhamento({
        tutorNome: tutor.nome || "",
        animalNome: animal.nome || "o paciente",
        autorNome,
        queixa,
        dataConsulta: consulta?.data || null,
      }),
      telefone: numero,
      comResumoClinico: Boolean(queixa.trim()),
    };
  });
