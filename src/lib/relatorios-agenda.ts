import {
  dataBR,
  diaNoFuso,
  FUSO_RELATORIOS,
  somarDias,
  type DadosRelatorio,
} from "./relatorios.ts";

export type AgendaRelatorio = {
  id: string;
  nome: string | null;
  responsavel: string | null;
  tipo: string | null;
  inicio: string | null;
  fim: string | null;
  dias_semana: number[] | null;
  intervalo_min: number | null;
  timezone: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type EventoAgendaRelatorio = {
  id: string;
  agenda_id: string;
  inicio: string;
  fim: string;
  estado: string | null;
  tipo: string | null;
  status_clinico?: string | null;
  reagendado_em?: string | null;
  pagamento_expira_em?: string | null;
  updated_at?: string | null;
};

export type EntradaFilaRelatorio = {
  chegada_em: string;
  chamado_em: string | null;
  status: string | null;
};

type Periodo = { inicio: string; fim: string };
type Faixa = [inicio: number, fim: number];

const umMinuto = 60_000;
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const porcentagem = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const chave = (s?: string | null) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ");
const emMs = (iso?: string | null) => Date.parse(iso ?? "");
const emMin = (ms: number) => inteiro.format(ms / umMinuto);
const proporcao = (n: number, d: number) => (d > 0 ? porcentagem.format(n / d) : "—");
const faixaAgenda = /^([01]\d|2[0-3]):([0-5]\d)(?::00(?:\.0+)?)?$/;

export function consolidarDadosAgenda<T extends { id: string; updated_at?: string | null }>(
  drive: readonly T[],
  postgres: readonly T[],
): T[] {
  const porId = new Map<string, T>();
  // A fonte canônica ganha no empate; uma edição efetivamente mais recente pode
  // estar na recepção (Drive) ou nos fluxos canônicos (PostgreSQL).
  for (const item of [...drive, ...postgres]) {
    if (!item.id) continue;
    const existente = porId.get(item.id);
    if (!existente || (emMs(item.updated_at) || 0) >= (emMs(existente.updated_at) || 0)) {
      porId.set(item.id, item);
    }
  }
  return [...porId.values()];
}

function diaValido(iso: string, fuso: string) {
  return Number.isFinite(emMs(iso)) ? diaNoFuso(iso, fuso) : null;
}

function emPeriodo(dia: string | null, { inicio, fim }: Periodo) {
  return dia !== null && inicio <= dia && dia <= fim;
}

function fusoValido(fuso?: string | null) {
  if (!fuso?.trim()) return FUSO_RELATORIOS;
  try {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: fuso.trim() }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

function minutosAgenda(valor?: string | null): number | null {
  const hora = faixaAgenda.exec(valor ?? "");
  if (!hora) return null;
  return Number(hora[1]) * 60 + Number(hora[2]);
}

/** Converte a hora da grade usando o deslocamento daquele dia no fuso da agenda. */
function instanteLocal(
  dia: string,
  minutos: number,
  formatador: Intl.DateTimeFormat,
): number | null {
  const alvo = emMs(dia + "T00:00:00Z") + minutos * umMinuto;
  let tentativa = alvo;
  for (let i = 0; i < 5; i++) {
    const partes = Object.fromEntries(
      formatador.formatToParts(tentativa).map(({ type, value }) => [type, Number(value)]),
    );
    const local = Date.UTC(partes.year, partes.month - 1, partes.day, partes.hour, partes.minute);
    if (local === alvo) return tentativa;
    tentativa += alvo - local;
  }
  return null;
}

function unirFaixas(faixas: Faixa[]): Faixa[] {
  const uniao: Faixa[] = [];
  for (const [ini, fim] of faixas.sort((a, b) => a[0] - b[0])) {
    const anterior = uniao.at(-1);
    if (anterior && ini <= anterior[1]) anterior[1] = Math.max(anterior[1], fim);
    else uniao.push([ini, fim]);
  }
  return uniao;
}

const duracao = (faixas: Faixa[]) => faixas.reduce((soma, [inicio, fim]) => soma + fim - inicio, 0);

function intersecao(a: Faixa[], b: Faixa[]) {
  let soma = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    soma += Math.max(0, Math.min(a[i][1], b[j][1]) - Math.max(a[i][0], b[j][0]));
    if (a[i][1] < b[j][1]) i++;
    else j++;
  }
  return soma;
}

function banhoETosa(tipo: string | null) {
  return /banho|tosa/.test(chave(tipo));
}

function bloqueio(evento: EventoAgendaRelatorio) {
  return chave(evento.tipo) === "bloqueio de agenda";
}

function desfecho(evento: EventoAgendaRelatorio) {
  const estado = chave(evento.estado);
  const clinico = chave(evento.status_clinico);
  const estados = new Set([estado, clinico]);
  const falta = ["falta", "faltou", "nao compareceu", "nao comparecimento"].some((s) =>
    estados.has(s),
  );
  const encerradoParaReagendar = ["reagendado", "remarcado"].some((s) => estados.has(s));
  const reagendamento = encerradoParaReagendar || Number.isFinite(emMs(evento.reagendado_em));
  const cancelado = estados.has("cancelado") && !falta;
  return { estado, clinico, falta, cancelado, reagendamento, encerradoParaReagendar };
}

function eventoAtivo(evento: EventoAgendaRelatorio, agora: number) {
  const { estado, cancelado, falta, encerradoParaReagendar } = desfecho(evento);
  if (cancelado || encerradoParaReagendar || estado === "expirado") return false;
  const prazo = emMs(evento.pagamento_expira_em);
  if (estado === "aguardando pagamento") return prazo > agora;
  if (estado === "reservado" && Number.isFinite(prazo)) return prazo > agora;
  // O painel da recepção trata pendentes e registros antigos sem estado como
  // horários que tomaram disponibilidade, mesmo sem confirmação de presença.
  return falta || ["confirmado", "solicitado", "reservado", "pendente", ""].includes(estado);
}

function descricaoAgenda(agenda: AgendaRelatorio) {
  return {
    agenda: agenda.nome?.trim() || "Sem nome",
    profissional: agenda.responsavel?.trim() || "Não informado",
  };
}

export function relatorioOcupacaoAgenda(
  agendas: AgendaRelatorio[],
  eventos: EventoAgendaRelatorio[],
  periodo: Periodo,
  agora = Date.now(),
): DadosRelatorio {
  const clinicas = agendas.filter((agenda) => !banhoETosa(agenda.tipo));
  const porAgenda = new Map<string, EventoAgendaRelatorio[]>();
  for (const evento of eventos) {
    const grupo = porAgenda.get(evento.agenda_id);
    if (grupo) grupo.push(evento);
    else porAgenda.set(evento.agenda_id, [evento]);
  }
  const total = { grade: 0, bloqueado: 0, ocupado: 0, agendasValidas: 0 };
  const porProfissional = new Map<
    string,
    { nome: string; agendas: number; grade: number; bloqueado: number; ocupado: number }
  >();
  let diasInvalidos = 0;
  let agendasInvalidas = 0;

  const linhas = clinicas.map((agenda) => {
    const info = descricaoAgenda(agenda);
    const inicio = minutosAgenda(agenda.inicio);
    const fim = minutosAgenda(agenda.fim);
    const passo = agenda.intervalo_min;
    const fuso = fusoValido(agenda.timezone);
    const dias = agenda.dias_semana;
    if (
      inicio === null ||
      fim === null ||
      fim <= inicio ||
      passo === null ||
      !Number.isInteger(passo) ||
      passo < 5 ||
      passo > 240 ||
      !fuso ||
      !Array.isArray(dias) ||
      dias.length === 0 ||
      dias.some((dia) => !Number.isInteger(dia) || dia < 0 || dia > 6)
    ) {
      agendasInvalidas++;
      return [info.agenda, info.profissional, "—", "—", "—", "—"];
    }
    const janelas = (porAgenda.get(agenda.id) ?? [])
      .filter((e) => eventoAtivo(e, agora))
      .flatMap((e) => {
        const inicio = emMs(e.inicio);
        const fim = emMs(e.fim);
        return Number.isFinite(inicio) && Number.isFinite(fim) && inicio < fim
          ? [{ faixa: [inicio, fim] as Faixa, bloqueio: bloqueio(e) }]
          : [];
      });
    const porFuso = new Intl.DateTimeFormat("en-GB", {
      timeZone: fuso,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    });
    const criadoDia = agenda.created_at ? diaValido(agenda.created_at, fuso) : null;
    let grade = 0;
    let bloqueado = 0;
    let ocupado = 0;
    let medicaoImpossivel = false;
    for (let dia = periodo.inicio; dia <= periodo.fim; dia = somarDias(dia, 1)) {
      if (
        (criadoDia && dia < criadoDia) ||
        !dias.includes(new Date(dia + "T00:00:00Z").getUTCDay())
      )
        continue;
      const ultimoSlot = inicio + Math.floor((fim - inicio) / passo) * passo;
      if (ultimoSlot === inicio) continue;
      const de = instanteLocal(dia, inicio, porFuso);
      const ate = instanteLocal(dia, ultimoSlot, porFuso);
      if (de === null || ate === null || ate <= de) {
        diasInvalidos++;
        medicaoImpossivel = true;
        continue;
      }
      const bloqueios: Faixa[] = [];
      const reservas: Faixa[] = [];
      for (const { faixa, bloqueio } of janelas) {
        const inicio = Math.max(de, faixa[0]);
        const fim = Math.min(ate, faixa[1]);
        if (inicio < fim) (bloqueio ? bloqueios : reservas).push([inicio, fim]);
      }
      const b = unirFaixas(bloqueios);
      const r = unirFaixas(reservas);
      grade += ate - de;
      bloqueado += duracao(b);
      ocupado += duracao(r) - intersecao(b, r);
    }
    if (medicaoImpossivel) {
      agendasInvalidas++;
      return [info.agenda, info.profissional, "—", "—", "—", "—"];
    }
    total.agendasValidas++;
    total.grade += grade;
    total.bloqueado += bloqueado;
    total.ocupado += ocupado;
    const nome = info.profissional;
    const grupo = porProfissional.get(chave(nome)) ?? {
      nome,
      agendas: 0,
      grade: 0,
      bloqueado: 0,
      ocupado: 0,
    };
    grupo.agendas++;
    grupo.grade += grade;
    grupo.bloqueado += bloqueado;
    grupo.ocupado += ocupado;
    porProfissional.set(chave(nome), grupo);
    return [
      info.agenda,
      nome,
      emMin(grade - bloqueado),
      emMin(bloqueado),
      emMin(ocupado),
      proporcao(ocupado, grade - bloqueado),
    ];
  });
  const linhasProfissionais = [...porProfissional.values()].map(
    ({ nome, agendas, grade, bloqueado, ocupado }) => [
      nome,
      agendas,
      emMin(grade - bloqueado),
      emMin(bloqueado),
      emMin(ocupado),
      proporcao(ocupado, grade - bloqueado),
    ],
  );
  return {
    indicadores: [
      { rotulo: "Agendas clínicas encontradas", valor: clinicas.length },
      {
        rotulo: "Capacidade disponível (min)",
        valor: total.agendasValidas ? emMin(total.grade - total.bloqueado) : "—",
      },
      { rotulo: "Tempo ocupado (min)", valor: total.agendasValidas ? emMin(total.ocupado) : "—" },
      {
        rotulo: "Ocupação das grades",
        valor: proporcao(total.ocupado, total.grade - total.bloqueado),
      },
    ],
    notas: [
      "Capacidade calculada pela grade semanal atual de cada agenda, no seu fuso horário. Não há histórico da grade: não representa a capacidade que estava configurada em uma data passada.",
      "Considera somente intervalos inteiros da grade. Bloqueios são retirados da capacidade e horários sobrepostos não são somados duas vezes na mesma agenda.",
      "Ocupação mede tempo agendado, não o tempo de atendimento. Inclui horários pendentes e legados sem estado, como na recepção. A soma por profissional agrupa pelo nome no cadastro, sem deduplicar horários entre agendas.",
      ...(agendasInvalidas
        ? [`${agendasInvalidas} agenda(s) sem grade utilizável ficaram fora dos totais.`]
        : []),
      ...(diasInvalidos
        ? [
            `${diasInvalidos} dia(s) com hora de grade inválida no fuso impediram o cálculo das respectivas agendas.`,
          ]
        : []),
    ],
    tabelas: [
      {
        titulo: "Por agenda clínica",
        colunas: [
          "Agenda",
          "Profissional",
          "Disponível (min)",
          "Bloqueado (min)",
          "Ocupado (min)",
          "Ocupação",
        ],
        linhas,
      },
      {
        titulo: "Por profissional",
        colunas: [
          "Profissional",
          "Agendas",
          "Disponível (min)",
          "Bloqueado (min)",
          "Ocupado (min)",
          "Ocupação",
        ],
        linhas: linhasProfissionais,
      },
    ],
  };
}

export function relatorioDesfechosAgenda(
  agendas: AgendaRelatorio[],
  eventos: EventoAgendaRelatorio[],
  periodo: Periodo,
): DadosRelatorio {
  const mapa = new Map(agendas.map((a) => [a.id, a]));
  const grupos = new Map<
    string,
    {
      agenda: string;
      profissional: string;
      total: number;
      cancelados: number;
      faltas: number;
      reagendados: number;
      expirados: number;
    }
  >();
  for (const evento of eventos) {
    const agenda = mapa.get(evento.agenda_id);
    if (bloqueio(evento) || banhoETosa(agenda?.tipo ?? evento.tipo)) continue;
    const fuso = fusoValido(agenda?.timezone) ?? FUSO_RELATORIOS;
    if (!emPeriodo(diaValido(evento.inicio, fuso), periodo)) continue;
    const info = agenda
      ? descricaoAgenda(agenda)
      : { agenda: "Agenda não disponível", profissional: "Não informado" };
    const anterior = grupos.get(evento.agenda_id) ?? {
      ...info,
      total: 0,
      cancelados: 0,
      faltas: 0,
      reagendados: 0,
      expirados: 0,
    };
    const estado = desfecho(evento);
    anterior.total++;
    if (estado.cancelado) anterior.cancelados++;
    if (estado.falta) anterior.faltas++;
    if (estado.reagendamento) anterior.reagendados++;
    if (estado.estado === "expirado" && !estado.cancelado) anterior.expirados++;
    grupos.set(evento.agenda_id, anterior);
  }
  const linhas = [...grupos.values()];
  const totais = linhas.reduce(
    (s, l) => ({
      total: s.total + l.total,
      cancelados: s.cancelados + l.cancelados,
      faltas: s.faltas + l.faltas,
      reagendados: s.reagendados + l.reagendados,
    }),
    { total: 0, cancelados: 0, faltas: 0, reagendados: 0 },
  );
  const observado = (total: number) => (total > 0 ? `≥ ${total}` : "Sem registro específico");
  return {
    indicadores: [
      { rotulo: "Agendamentos registrados", valor: totais.total },
      { rotulo: "Cancelamentos registrados", valor: totais.cancelados },
      { rotulo: "Faltas identificadas", valor: observado(totais.faltas) },
      { rotulo: "Reagendamentos identificados", valor: observado(totais.reagendados) },
    ],
    notas: [
      "O período considera a data atualmente registrada para o horário, não a data em que ele foi cancelado ou alterado. Bloqueios e reservas expiradas não são cancelamentos clínicos.",
      "Faltas e reagendamentos mostram apenas registros explícitos. Cada agendamento reagendado conta uma vez na sua data atual, mesmo que tenha mudado mais de uma vez. Registros antigos podem não ter histórico: sem registro específico não significa zero.",
    ],
    tabelas: [
      {
        titulo: "Desfechos por agenda clínica",
        colunas: [
          "Agenda",
          "Profissional",
          "Registros",
          "Cancelados",
          "Reservas expiradas",
          "Faltas",
          "Reagendamentos",
        ],
        linhas: linhas.map((l) => [
          l.agenda,
          l.profissional,
          l.total,
          l.cancelados,
          l.expirados,
          observado(l.faltas),
          observado(l.reagendados),
        ]),
      },
    ],
  };
}

function calculoFila(linhas: EntradaFilaRelatorio[]) {
  const espera: number[] = [];
  let chamados = 0;
  let aguardando = 0;
  for (const linha of linhas) {
    const status = chave(linha.status);
    if (status === "aguardando") aguardando++;
    if (status !== "chamado") continue;
    chamados++;
    const minutos = emMs(linha.chamado_em) - emMs(linha.chegada_em);
    if (Number.isFinite(minutos) && minutos >= 0) espera.push(minutos);
  }
  espera.sort((a, b) => a - b);
  const meio = Math.floor(espera.length / 2);
  const mediana = !espera.length
    ? null
    : espera.length % 2
      ? espera[meio]
      : (espera[meio - 1] + espera[meio]) / 2;
  const media = espera.length ? espera.reduce((a, b) => a + b, 0) / espera.length : null;
  return {
    total: linhas.length,
    chamados,
    aguardando,
    outros: linhas.length - chamados - aguardando,
    comHorario: espera.length,
    media: media === null ? "—" : emMin(media),
    mediana: mediana === null ? "—" : emMin(mediana),
    taxa: proporcao(chamados, linhas.length),
  };
}

export function relatorioTempoFila(
  entradas: EntradaFilaRelatorio[],
  periodo: Periodo,
): DadosRelatorio {
  const porDia = new Map<string, EntradaFilaRelatorio[]>();
  for (const linha of entradas) {
    const dia = diaValido(linha.chegada_em, FUSO_RELATORIOS);
    if (!dia || !emPeriodo(dia, periodo)) continue;
    const grupo = porDia.get(dia);
    if (grupo) grupo.push(linha);
    else porDia.set(dia, [linha]);
  }
  const total = calculoFila([...porDia.values()].flat());
  return {
    indicadores: [
      { rotulo: "Entradas registradas", valor: total.total },
      { rotulo: "Chamados", valor: total.chamados },
      { rotulo: "Aguardando agora", valor: total.aguardando },
      { rotulo: "Espera média até chamar (min)", valor: total.media },
      { rotulo: "Conversão em chamada", valor: total.taxa },
      { rotulo: "Conversão em atendimento", valor: "Não rastreada" },
    ],
    notas: [
      "Agrupa pela data de chegada (horário de Brasília). Mede da chegada até a chamada somente quando ambos os horários válidos foram registrados.",
      "Chamar na fila não confirma um atendimento. Não há vínculo gravado da entrada da fila com um atendimento concluído; por isso a conversão clínica não é estimada.",
      "Os números cobrem apenas entradas ainda registradas. Remoções e retornos à fila podem não ter histórico suficiente para reconstruir o passado.",
    ],
    tabelas: [
      {
        titulo: "Fila por data de chegada",
        colunas: [
          "Data",
          "Entradas",
          "Chamados",
          "Aguardando agora",
          "Outros status",
          "Chamados com espera válida",
          "Espera média (min)",
          "Mediana (min)",
          "Conversão em chamada",
        ],
        linhas: [...porDia]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([dia, grupo]) => {
            const r = calculoFila(grupo);
            return [
              dataBR(dia),
              r.total,
              r.chamados,
              r.aguardando,
              r.outros,
              r.comHorario,
              r.media,
              r.mediana,
              r.taxa,
            ];
          }),
      },
    ],
  };
}
