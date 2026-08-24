import { useEffect, useState, useSyncExternalStore } from "react";
import {
  carregarAlarmes,
  padraoJejum,
  proximoDisparo,
  reprogramar,
  salvarAlarmes,
  type Alarme,
} from "@/lib/alarmes";

let alarmes: Alarme[] = [];
let tocando: Alarme | null = null;
let iniciado = false;
let intervalo: number | null = null;
const ouvintes = new Set<() => void>();

function notificar() {
  ouvintes.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

const getAlarmes = () => alarmes;
const getTocando = () => tocando;

export function definirAlarmes(valor: Alarme[] | ((atual: Alarme[]) => Alarme[])) {
  alarmes = typeof valor === "function" ? valor(alarmes) : valor;
  salvarAlarmes(alarmes);
  notificar();
}

function avisarSistema(a: Alarme) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification("Alarme — Veterício", { body: a.rotulo, tag: a.id });
  } catch {
    /* notificação indisponível */
  }
}

function verificar() {
  if (tocando) return;
  const agora = Date.now();
  const vencido = alarmes.find(
    (a) => a.ativo && new Date(a.proximo).getTime() <= agora,
  );
  if (!vencido) return;
  tocando = vencido;
  alarmes = alarmes.map((a) => (a.id === vencido.id ? reprogramar(a) : a));
  salvarAlarmes(alarmes);
  avisarSistema(vencido);
  notificar();
}

export function pararAlarmeAtivo() {
  tocando = null;
  notificar();
}

export function adiarAlarmeAtivo(minutos = 5) {
  const atual = tocando;
  tocando = null;
  if (atual) {
    const proximo = new Date(Date.now() + minutos * 60000).toISOString();
    alarmes = alarmes.map((a) => (a.id === atual.id ? { ...a, ativo: true, proximo } : a));
    salvarAlarmes(alarmes);
  }
  notificar();
}

/** Liga o alarme de jejum das 00h (usado ao começar um plantão noturno). */
export function ativarJejumNoturno() {
  if (!iniciado) {
    iniciado = true;
    alarmes = carregarAlarmes();
  }
  const jejum = alarmes.find((a) => a.id === "jejum-00h");
  const ligado: Alarme = jejum
    ? { ...jejum, ativo: true, proximo: proximoDisparo(jejum.hora) }
    : { ...padraoJejum(), ativo: true };
  alarmes = jejum
    ? alarmes.map((a) => (a.id === "jejum-00h" ? ligado : a))
    : [ligado, ...alarmes];
  salvarAlarmes(alarmes);
  notificar();
}

/** Remove os alarmes criados por curvas (ao finalizar o plantão). */
export function limparAlarmesDeCurva() {
  if (!iniciado) {
    iniciado = true;
    alarmes = carregarAlarmes();
  }
  alarmes = alarmes.filter((a) => !a.curvaId);
  salvarAlarmes(alarmes);
  notificar();
}

/** Encerra todos os alarmes (ao finalizar o plantão): desliga e remove os de curva. */
export function encerrarTodosAlarmes() {
  if (!iniciado) {
    iniciado = true;
    alarmes = carregarAlarmes();
  }
  tocando = null;
  alarmes = alarmes
    .filter((a) => !a.curvaId)
    .map((a) => (a.ativo ? { ...a, ativo: false } : a));
  salvarAlarmes(alarmes);
  notificar();
}

export function useAlarmes() {
  const lista = useSyncExternalStore(subscribe, getAlarmes, getAlarmes);
  const ativo = useSyncExternalStore(subscribe, getTocando, getTocando);
  const [carregado, setCarregado] = useState(iniciado);

  useEffect(() => {
    if (!iniciado) {
      iniciado = true;
      alarmes = carregarAlarmes();
      notificar();
    }
    if (intervalo === null) {
      intervalo = window.setInterval(verificar, 1000);
    }
    setCarregado(true);
  }, []);

  return {
    alarmes: lista,
    setAlarmes: definirAlarmes,
    alarmeTocando: ativo,
    carregado,
  };
}
