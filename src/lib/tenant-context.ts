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
  if (!resultado?.[1]) return null;
  try {
    const slug = decodeURIComponent(resultado[1]).toLowerCase();
    // Rejeita segmentos codificados que poderiam virar uma rota diferente.
    return /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/.test(slug) ? slug : null;
  } catch {
    // Um escape de URL inválido não deve derrubar o carregamento do aplicativo.
    return null;
  }
}

export function hostDaPagina(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname.toLowerCase().replace(/^www\./, "");
}
