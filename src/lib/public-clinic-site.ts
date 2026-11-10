import type { ClinicSiteConfig } from "@/lib/clinic-site";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://mwrmfcyrdxfxssebgknz.supabase.co";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_Y5qsG-0F69poaQjUnWxGKw_8WOydkZc";

export type PublicClinicSite = { slug: string; template: string; config: ClinicSiteConfig };
export type PublicVisualDocument = { version: 1; updatedAt: string; pages: Record<string, any> };
type PublicClinic = { clinica_slug?: string | null };

export function normalizeHostname(value: string | null | undefined): string {
  return String(value || "").split(":", 1)[0].trim().toLowerCase().replace(/^www\./, "");
}

export function isPlatformHostname(hostname: string): boolean {
  return hostname === "oricse.com.br" || hostname === "app.oricse.com.br" || hostname === "oricse.com" || hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".workers.dev") || hostname.endsWith(".lovable.app");
}

function publicHeaders(): HeadersInit { return { apikey: supabasePublishableKey, accept: "application/json" }; }

export async function findPublicClinicSlug(hostname: string): Promise<string | null> {
  const host = normalizeHostname(hostname);
  if (!host || isPlatformHostname(host)) return null;
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/oricse_clinica_publica_portal`, {
    method: "POST", headers: { ...publicHeaders(), "content-type": "application/json" }, body: JSON.stringify({ p_host: host }), signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`Não foi possível resolver o domínio público (${response.status}).`);
  const clinics = await response.json() as PublicClinic[];
  const slug = clinics[0]?.clinica_slug?.trim().toLowerCase();
  return slug && /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/.test(slug) ? slug : null;
}

export async function loadPublicClinicSite(slug: string): Promise<PublicClinicSite | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/.test(normalizedSlug)) return null;
  const query = new URLSearchParams({ select: "slug,template,config", slug: `eq.${normalizedSlug}`, status: "eq.publicado", limit: "1" });
  const response = await fetch(`${supabaseUrl}/rest/v1/clinic_sites?${query}`, { headers: publicHeaders(), signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`Não foi possível carregar o site da clínica (${response.status}).`);
  return (await response.json() as PublicClinicSite[])[0] || null;
}


/** Layout publicado para a primeira pintura pública; rascunhos nunca são expostos. */
export async function loadPublicVisualDocument(): Promise<PublicVisualDocument> {
  const query = new URLSearchParams({ select: "valor", chave: "eq.visual_editor_published", limit: "1" });
  const response = await fetch(`${supabaseUrl}/rest/v1/oricse_config?${query}`, {
    headers: publicHeaders(),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`Não foi possível carregar o layout publicado (${response.status}).`);
  const rows = await response.json() as Array<{ valor?: unknown }>;
  const value = rows[0]?.valor;
  return value && typeof value === "object" ? value as PublicVisualDocument : { version: 1, updatedAt: "", pages: {} };
}
