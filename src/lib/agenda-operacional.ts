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
