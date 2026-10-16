import { oricseStorage, oricseSession } from "@/lib/oricse-storage";
export const CHAVE_LOGO_CABECALHO = "vetericio-logo-cabecalho-v1";
export const EVENTO_LOGO_CABECALHO = "vetericio-logo-cabecalho-alterada";

export function carregarLogoCabecalho(): string {
  if (typeof window === "undefined") return "";
  return oricseStorage.getItem(CHAVE_LOGO_CABECALHO) || "";
}

export function salvarLogoCabecalho(logo: string) {
  oricseStorage.setItem(CHAVE_LOGO_CABECALHO, logo);
  window.dispatchEvent(new Event(EVENTO_LOGO_CABECALHO));
}

export function restaurarLogoCabecalho() {
  oricseStorage.removeItem(CHAVE_LOGO_CABECALHO);
  window.dispatchEvent(new Event(EVENTO_LOGO_CABECALHO));
}
