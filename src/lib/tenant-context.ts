import { createContext, useContext } from "react";

export type ClinicPortalInfo = {
  clinica_id: string;
  clinica_nome: string;
  clinica_slug: string | null;
  clinica_logo_url: string | null;
};

export type ClinicTenantInfo = ClinicPortalInfo & {
  clinica_dominio: string | null;
};

export type TenantContextValue = {
  portal: ClinicPortalInfo | null;
  loading: boolean;
  error: string | null;
};

export const TenantContext = createContext<TenantContextValue>({
  portal: null,
  loading: true,
  error: null,
});

export function useTenantContext() {
  return useContext(TenantContext);
}

export function slugDaRota(pathname: string): string | null {
  const resultado = pathname.match(/^\/vet\/([^/]+)\/?$/i);
  return resultado?.[1] ? decodeURIComponent(resultado[1]).toLowerCase() : null;
}

export function hostDaPagina(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname.toLowerCase().replace(/^www\./, "");
}
