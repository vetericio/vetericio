import { AVISO_URGENCIA_ACOMPANHAMENTO } from "./crm-mensagem-local";
/**
 * Planejamento de contatos pós-cirúrgicos.
 *
 * Módulo puro: sem banco, side effects, IA externa ou envio de mensagens.
 * As tarefas são geradas apenas a partir de procedimento clínico concluído.
 * A autorização de contato deve ser revalidada no servidor no ato do contato.
 */
export type RegistroCirurgicoConcluido = {
  id: string;
  clinicaId: string;
  animalId: string;
  tutorId: string;
  dataProcedimento: string; // YYYY-MM-DD, calendário local da clínica
  dataAlta?: string | null;
  status: "rascunho" | "concluido" | "cancelado";
  acompanhamentoAprovado: boolean;
  obitoRegistrado?: boolean;
  procedimento?: string;
};

export type TarefaPosCirurgica = {
  clinicaId: string;
  registroId: string;
  animalId: string;
  tutorId: string;
  dia: number;
  dataPrevista: string;
  chaveDedupe: string;
  titulo: string;
  perguntas: readonly string[];
  prioridade: "normal";
};

export type RegistroPersistido = {
  id?: unknown;
  clinicaId?: unknown;
  animalId?: unknown;
  tutorId?: unknown;
  subtipo?: unknown;
  status?: unknown;
  data?: unknown;
  autorNome?: unknown;
  titulo?: unknown;
  dados?: unknown;
};

export type FontePosCirurgica = {
  id: string;
  clinicaId: string;
  animalId: string;
  tutorId: string;
  animalNome: string;
  tutorNome: string;
  dataProcedimento: string;
  dataAlta: string | null;
  autorNome: string;
  acompanhamentoAprovado: true;
  obitoRegistrado: boolean;
  telefone: string;
  outroTelefone: string;
  email: string;
  autorizaLembretes: boolean;
  autorizaWhatsapp: boolean;
  autorizaEmail: boolean;
};

/** Limita a campos declarados e só aceita cirurgia concluída da clínica ativa. */
export function fonteClinicaElegivel(registro: RegistroPersistido, clinicaId: string): boolean {
  const dados = registro.dados;
  return Boolean(
    registro &&
    registro.clinicaId === clinicaId &&
    registro.subtipo === "Cirurgia / Procedimentos" &&
    registro.status === "concluido" &&
    typeof registro.id === "string" &&
    typeof registro.animalId === "string" &&
    typeof registro.tutorId === "string" &&
    typeof registro.data === "string" &&
    dados && typeof dados === "object" && !Array.isArray(dados) &&
    (dados as Record<string, unknown>).acompanhamentoCrm === true &&
    (dados as Record<string, unknown>).obitoRegistrado !== true
  );
}


export const DIAS_POS_CIRURGICO_PADRAO = [1, 3, 7, 10] as const;

const PERGUNTAS_POR_ETAPA: Record<number, readonly string[]> = {
  1: ["Como está a disposição?", "Está se alimentando?", "A dor parece controlada?", "Houve alguma intercorrência?"],
  3: ["Como está a recuperação?", "As medicações estão sendo administradas conforme a orientação?", "Como está a ferida cirúrgica?"],
  7: ["Como está a recuperação?", "Algum sinal novo ou preocupação?", "A reavaliação está agendada?"],
  10: ["O paciente está melhor?", "A revisão ou retirada de pontos, se indicada, foi organizada?"],
};

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
function lerDia(data: string): Date | null {
  const m = DATA.exec(data);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  if (d.toISOString().slice(0, 10) !== data) return null;
  return d;
}
export function deslocarDia(data: string, dias: number): string | null {
  const d = lerDia(data);
  if (!d || !Number.isInteger(dias) || dias < 0 || dias > 365) return null;
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
export function normalizarProtocolo(dias: readonly number[] = DIAS_POS_CIRURGICO_PADRAO): number[] {
  return [...new Set(dias.filter((d) => Number.isInteger(d) && d >= 0 && d <= 90))].sort((a, b) => a - b);
}
export function gerarTarefasPosCirurgicas(
  registro: RegistroCirurgicoConcluido,
  dias: readonly number[] = DIAS_POS_CIRURGICO_PADRAO,
): TarefaPosCirurgica[] {
  if (
    registro.status !== "concluido" ||
    !registro.acompanhamentoAprovado ||
    registro.obitoRegistrado ||
    !registro.id || !registro.clinicaId || !registro.animalId || !registro.tutorId
  ) return [];

  const dataBase = registro.dataAlta || registro.dataProcedimento;
  if (!lerDia(dataBase)) return [];
  // Nunca aceitar alta anterior ao procedimento, para não disparar contato errado.
  if (registro.dataAlta && registro.dataAlta < registro.dataProcedimento) return [];

  return normalizarProtocolo(dias).flatMap((dia): TarefaPosCirurgica[] => {
    const dataPrevista = deslocarDia(dataBase, dia);
    if (!dataPrevista) return [];
    return [{
      clinicaId: registro.clinicaId,
      registroId: registro.id,
      animalId: registro.animalId,
      tutorId: registro.tutorId,
      dia,
      dataPrevista,
      chaveDedupe: `pos_cirurgico:registro:${registro.id}:d${dia}`,
      titulo: `Acompanhamento pós-cirúrgico D+${dia}`,
      perguntas: PERGUNTAS_POR_ETAPA[dia] || ["Como está a recuperação?", "Houve alguma intercorrência?"],
      prioridade: "normal",
    }];
  });
}

export function mensagemPosCirurgica(
  dados: { tutorNome: string; animalNome: string },
  tarefa: Pick<TarefaPosCirurgica, "dia" | "perguntas">,
) {
  const primeiroNome = (dados.tutorNome || "").trim().split(/\s+/)[0]?.replace(/[\r\n<>]/g, "") || "";
  const animal = (dados.animalNome || "").trim().replace(/[\r\n<>]/g, " ").slice(0, 90) || "seu animal";
  const saudacao = primeiroNome ? `Oi, ${primeiroNome}!` : "Oi!";
  const perguntas = tarefa.perguntas.join(" ");
  return `${saudacao} Aqui é da equipe veterinária.\n\nComo está a recuperação de ${animal}? ${perguntas}\n\n${AVISO_URGENCIA_ACOMPANHAMENTO}`;
}

export function precisaAvaliacaoPrioritaria(resposta: {
  dificuldadeRespiratoria?: boolean;
  sangramentoImportante?: boolean;
  prostracaoIntensa?: boolean;
  dorIntensa?: boolean;
  outraIntercorrencia?: boolean;
}): boolean {
  return Object.values(resposta).some(Boolean);
}
