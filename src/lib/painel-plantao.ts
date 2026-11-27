import type { Medicacao, Registro } from "./ficha";

export const FUSO_PLANTAO = "America/Sao_Paulo";
const horaMs = 3_600_000;
const diaMs = 24 * horaMs;
const janelaAgora = 15 * 60_000;
export type ClassePlantao = "atrasadas" | "agora" | "proximas";
export type TipoEventoPlantao = "dose" | "ocorrencia" | "passagem";
export type EstadoExecucaoPlantao = "realizada" | "nao_realizada";
export type EventoPlantao = {
  chave: string;
  turno_chave: string;
  tipo: TipoEventoPlantao;
  registro_id: string | null;
  paciente: string | null;
  medicamento: string | null;
  agendado_em: string | null;
  estado: EstadoExecucaoPlantao | null;
  texto: string;
  autor_nome: string;
  registrado_em: string;
};
export type DosePlantao = {
  chave: string;
  registroId: string;
  paciente: string;
  baia: string;
  medicamento: string;
  dose: string;
  quantidade: string;
  via: string;
  horario: string;
  confirmada: boolean;
};
export type PacientePlantao = { id: string; nome: string; baia: string };
export type TurnoPainel = {
  chave: string;
  dia: string;
  turno: "diurno" | "noturno";
  inicio: number | null;
};
export type PainelPlantao = {
  turno: Pick<TurnoPainel, "chave" | "dia" | "turno"> | null;
  agora: string;
  pacientes: PacientePlantao[];
  doses: DosePlantao[];
  eventos: EventoPlantao[];
  semProgramacao: number;
  programacoesLegadas: number;
};

export function turnoDoPainel(entrada: unknown): TurnoPainel | null {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) return null;
  const e = entrada as Record<string, unknown>;
  if (
    typeof e.dia !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(e.dia) ||
    !Number.isFinite(Date.parse(e.dia)) ||
    new Date(e.dia).toISOString().slice(0, 10) !== e.dia ||
    (e.turno !== "diurno" && e.turno !== "noturno")
  )
    return null;
  const id = typeof e.id === "string" && /^[a-f\d-]{36}$/i.test(e.id) ? e.id : null;
  const escolha =
    typeof e.escolhidoEm === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.escolhidoEm)
      ? e.escolhidoEm
      : e.dia;
  const inicio = typeof e.iniciadoEm === "string" ? Date.parse(e.iniciadoEm) : NaN;
  return {
    chave: id || `legado:${e.dia}:${e.turno}:${escolha}`,
    dia: e.dia,
    turno: e.turno,
    inicio: Number.isFinite(inicio) ? inicio : null,
  };
}

const fuso = new Intl.DateTimeFormat("sv-SE", {
  timeZone: FUSO_PLANTAO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
export function horarioCivilPlantao(iso: string) {
  const [dia, horario] = fuso.format(new Date(iso)).split(" ");
  return { dia, horario: horario.slice(0, 5) };
}

function instanteCivil(dia: string, hora: string) {
  const alvo = Date.parse(`${dia}T${hora}:00Z`);
  if (!Number.isFinite(alvo)) return NaN;
  let tentativa = alvo;
  for (let i = 0; i < 3; i++) {
    const aparente = Date.parse(fuso.format(new Date(tentativa)).replace(" ", "T") + "Z");
    tentativa += alvo - aparente;
  }
  const verificado = horarioCivilPlantao(new Date(tentativa).toISOString());
  return verificado.dia === dia && verificado.horario === hora ? tentativa : NaN;
}

function horasDeIntervalo(duracao: string) {
  const match =
    /^\s*(?:a\s*cada\s*)?(\d{1,3}(?:[,.]\d{1,2})?)\s*h(?:oras?)?\s*$/i.exec(duracao) ??
    /^\s*(\d{1,3})\s*\/\s*\1\s*h\s*$/i.exec(duracao);
  if (!match) return null;
  const horas = Number(match[1].replace(",", "."));
  return horas >= 0.25 ? horas : null;
}

const limpar = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 300) : "");
async function chaveEscala(partes: string[]) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(partes)),
  );
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Expande só intervalos explícitos. Nunca usa dose/peso para inferir posologia. */
export async function programarPlantao(registros: Registro[], turno: TurnoPainel, agora: number) {
  const pacientes: PacientePlantao[] = [];
  const doses: DosePlantao[] = [];
  let semProgramacao = 0;
  let programacoesLegadas = 0;
  const dosesSobrepostas = new Set<string>();
  const chavesGeradas = new Set<string>();
  const ids = new Set<string>();
  for (const r of registros) {
    const id = limpar(r?.id);
    const nome = limpar(r?.animal);
    if (!id || !nome || r.obito || ids.has(id)) continue;
    ids.add(id);
    const baia = limpar(r.baia);
    pacientes.push({ id, nome, baia });
    const criado = typeof r.criadoEm === "string" ? Date.parse(r.criadoEm) : NaN;
    const conhecidas = new Map<
      string,
      { assinatura: string[]; m: Medicacao; repeticoes: number }
    >();
    for (const m of Array.isArray(r.medicacoes) ? r.medicacoes : []) {
      if (!m || typeof m !== "object" || m.aplicadoEm) continue;
      const horario = limpar(m.horarioInicial);
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(horario) || !limpar(m.nome)) {
        semProgramacao++;
        continue;
      }
      const assinatura = [
        id,
        limpar(m.nomeMenor),
        limpar(m.nome),
        limpar(m.dose),
        limpar(m.duracao),
        limpar(m.via),
        limpar(m.quantidade),
        horario,
      ];
      const ordem = JSON.stringify(assinatura);
      const anterior = conhecidas.get(ordem);
      if (anterior) anterior.repeticoes++;
      else conhecidas.set(ordem, { assinatura, m, repeticoes: 1 });
    }
    for (const { assinatura, m, repeticoes } of conhecidas.values()) {
      if (repeticoes > 1) {
        semProgramacao += repeticoes;
        continue;
      }
      const programada = typeof m.programadaEm === "string" ? Date.parse(m.programadaEm) : NaN;
      const confirmada = Number.isFinite(programada) && programada <= agora;
      if (!confirmada) programacoesLegadas++;
      const minuto = (t: number) => Math.floor(t / 60_000) * 60_000;
      const inicio = confirmada
        ? Math.max(
            agora - diaMs,
            minuto(turno.inicio ?? agora - diaMs),
            minuto(Number.isFinite(criado) ? criado : programada),
            minuto(programada),
          )
        : agora;
      const diaFicha = Number.isFinite(criado)
        ? horarioCivilPlantao(new Date(criado).toISOString()).dia
        : turno.dia;
      let diaInicial = confirmada
        ? horarioCivilPlantao(new Date(programada).toISOString()).dia
        : diaFicha > turno.dia
          ? diaFicha
          : turno.dia;
      let primeiro = instanteCivil(diaInicial, assinatura[7]);
      // Horário inicial confirmado no formulário representa a primeira dose
      // futura na hora informada. Nunca se fabricam ocorrências retroativas.
      if (confirmada && primeiro < minuto(programada)) {
        diaInicial = new Date(Date.parse(diaInicial) + diaMs).toISOString().slice(0, 10);
        primeiro = instanteCivil(diaInicial, assinatura[7]);
      }
      if (!confirmada && !assinatura[4] && primeiro < agora) {
        diaInicial = horarioCivilPlantao(new Date(agora).toISOString()).dia;
        primeiro = instanteCivil(diaInicial, assinatura[7]);
        if (primeiro < agora)
          primeiro = instanteCivil(
            new Date(Date.parse(diaInicial) + diaMs).toISOString().slice(0, 10),
            assinatura[7],
          );
      }
      if (!Number.isFinite(primeiro)) {
        semProgramacao++;
        continue;
      }
      const intervalo = horasDeIntervalo(assinatura[4]);
      if (assinatura[4] && !intervalo) {
        semProgramacao++;
        continue;
      }
      // Quantidade, dose, via ou intervalo editados não apagam a execução
      // já registrada para o mesmo paciente/medicamento/instante.
      const identidade = await chaveEscala([
        id,
        assinatura[1].toLocaleLowerCase("pt-BR"),
        assinatura[2].toLocaleLowerCase("pt-BR"),
      ]);
      const limite = agora + diaMs;
      const passo = intervalo ? Math.round(intervalo * horaMs) : 0;
      const primeiraVisivel = passo
        ? primeiro + passo * Math.max(0, Math.ceil((inicio - primeiro) / passo))
        : primeiro;
      for (
        let instante = primeiraVisivel;
        instante >= inicio && instante < limite;
        instante += passo
      ) {
        const horario = new Date(instante).toISOString();
        if (doses.length >= 5000)
          throw new Error(
            "Há mais de 5.000 horários neste recorte. Confira as programações da internação.",
          );
        const chave = `${identidade}:${horario}`;
        if (chavesGeradas.has(chave)) dosesSobrepostas.add(chave);
        chavesGeradas.add(chave);
        doses.push({
          chave,
          confirmada,
          registroId: id,
          paciente: nome,
          baia,
          horario,
          medicamento: [limpar(m.nomeMenor), limpar(m.nome)].filter(Boolean).join(" "),
          dose: limpar(m.dose),
          quantidade: limpar(m.quantidade),
          via: limpar(m.via),
        });
        if (!passo) break;
      }
    }
  }
  pacientes.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.id.localeCompare(b.id));
  doses.sort(
    (a, b) => a.horario.localeCompare(b.horario) || a.paciente.localeCompare(b.paciente, "pt-BR"),
  );
  return {
    pacientes,
    doses: doses.filter((d) => !dosesSobrepostas.has(d.chave)),
    semProgramacao: semProgramacao + dosesSobrepostas.size,
    programacoesLegadas,
  };
}

export function classeDaDose(horario: string, agora: number): ClassePlantao {
  const diferenca = Date.parse(horario) - agora;
  return diferenca < -janelaAgora ? "atrasadas" : diferenca <= janelaAgora ? "agora" : "proximas";
}

export function colunaDeHorario(iso: string) {
  const { dia, horario } = horarioCivilPlantao(iso);
  return `${dia}T${horario.slice(0, 2)}:00`;
}
