export type VisaoAgenda = "dia" | "semana" | "mes";
export const STATUS_AGENDA = [
  "Aguardando aprovação",
  "Reservado",
  "Agendado",
  "Chegou",
  "Em atendimento",
  "Finalizado",
  "Não compareceu",
  "Cancelado",
  "Expirado",
] as const;
export type StatusAgenda = (typeof STATUS_AGENDA)[number];

export const STATUS_BANHO: Record<string, string> = {
  agendado: "Agendado",
  recebido: "Recebido",
  em_execucao: "Em atendimento",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};
const rotulos = new Set<string>(STATUS_AGENDA);
export function statusAgenda(estado: string, dado: unknown): StatusAgenda {
  if (estado === "expirado") return "Expirado";
  if (estado === "cancelado") return dado === "Não compareceu" ? "Não compareceu" : "Cancelado";
  if (estado === "solicitado") return "Aguardando aprovação";
  if (estado === "reservado") return "Reservado";
  return typeof dado === "string" && rotulos.has(dado) ? (dado as StatusAgenda) : "Agendado";
}
export const FUSO_PADRAO_AGENDA = "America/Sao_Paulo";

export function categoriaAgendaBanhoTosa(tipo?: string | null) {
  const nome = String(tipo || "").toLocaleLowerCase("pt-BR");
  const banho = nome.includes("banho"),
    tosa = nome.includes("tosa");
  if (banho && tosa) return "banho e tosa";
  if (banho) return "banho";
  if (tosa) return "tosa";
  return "";
}

const formatadoresAgenda = new Map<string, Intl.DateTimeFormat>();
function partesNoFuso(instante: Date, fuso: string) {
  if (!Number.isFinite(instante.getTime())) return null;
  let fmt = formatadoresAgenda.get(fuso);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: fuso,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
    } catch {
      return fuso === FUSO_PADRAO_AGENDA ? null : partesNoFuso(instante, FUSO_PADRAO_AGENDA);
    }
    formatadoresAgenda.set(fuso, fmt);
  }
  return Object.fromEntries(fmt.formatToParts(instante).map(({ type, value }) => [type, value]));
}

export function dataHoraNoFuso(instante: Date, fuso = FUSO_PADRAO_AGENDA) {
  const p = partesNoFuso(instante, fuso || FUSO_PADRAO_AGENDA);
  return p ? { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` } : null;
}

/** Um horário de parede da agenda vira um instante independente do navegador. */
export function instanteDaAgenda(data: string, hora: string, fuso = FUSO_PADRAO_AGENDA) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora)) return null;
  const alvo = Date.parse(`${data}T${hora}:00Z`);
  if (!Number.isFinite(alvo)) return null;
  let ms = alvo;
  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    const local = dataHoraNoFuso(new Date(ms), fuso);
    if (!local) return null;
    if (local.data === data && local.hora === hora) return new Date(ms).toISOString();
    ms += alvo - Date.parse(`${local.data}T${local.hora}:00Z`);
  }
  return null;
}

export function acoesAgenda(estado: StatusAgenda, inicio: string, agora = Date.now()) {
  if (estado === "Agendado")
    return {
      chegado: true,
      atender: true,
      remarcar: true,
      falta: Date.parse(inicio) <= agora,
    };
  if (estado === "Chegou") return { chegado: false, atender: true, remarcar: false, falta: false };
  if (estado === "Em atendimento")
    return { chegado: false, atender: true, remarcar: false, falta: false };
  return {
    chegado: false,
    atender: false,
    remarcar: estado === "Aguardando aprovação",
    falta: false,
  };
}

export function isoLocalAgenda(d: Date) {
  return [
    String(d.getFullYear()).padStart(4, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
function dia(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d, 12);
}
function somar(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
}
export function diasDaVisaoAgenda(iso: string, visao: VisaoAgenda) {
  const d = dia(iso);
  if (visao === "dia") return [iso];
  const base = visao === "semana" ? d : new Date(d.getFullYear(), d.getMonth(), 1, 12);
  const comeco = somar(base, -base.getDay());
  const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
  const quantidade = visao === "semana" ? 7 : Math.ceil((fim.getDate() + base.getDay()) / 7) * 7;
  return Array.from({ length: quantidade }, (_, i) => isoLocalAgenda(somar(comeco, i)));
}
export function moverVisaoAgenda(iso: string, visao: VisaoAgenda, sentido: -1 | 1) {
  const d = dia(iso);
  if (visao !== "mes") return isoLocalAgenda(somar(d, sentido * (visao === "semana" ? 7 : 1)));
  const mes = new Date(d.getFullYear(), d.getMonth() + sentido, 1, 12);
  const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0, 12).getDate();
  mes.setDate(Math.min(d.getDate(), ultimo));
  return isoLocalAgenda(mes);
}
export function normalizarBuscaAgenda(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
export const SIT_OPERACIONAL_OCUPA = new Set<StatusAgenda>([
  "Agendado",
  "Aguardando aprovação",
  "Reservado",
  "Chegou",
  "Em atendimento",
  "Finalizado",
]);
