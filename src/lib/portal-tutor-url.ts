import type { ClinicSiteTemplate } from "@/lib/clinic-site";

const slugDeClinica = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const hostsReservados = new Set(["app", "www"]);

export function urlPortalDoTutor(slug: string, modelo?: ClinicSiteTemplate) {
  const url = `https://${slug}.oricse.com.br/portaldotutor`;
  return slug === "alvorada" && modelo ? `${url}?modelo=${modelo}` : url;
}

export function urlSiteDaClinica(slug: string, modelo?: ClinicSiteTemplate) {
  const url = new URL("/", urlPortalDoTutor(slug));
  if (slug === "alvorada" && modelo) url.searchParams.set("modelo", modelo);
  return url.href;
}

export function slugPortalDoTutor(hostname: string) {
  const slug = hostname.toLowerCase().match(/^([^.]+)\.oricse\.com\.br$/)?.[1];
  return slug && slugDeClinica.test(slug) && !hostsReservados.has(slug) ? slug : null;
}

export function destinoPortalLegado(pathname: string, search = "", hash = "") {
  const segmento = pathname.match(/^\/pet\/([^/]+)(?:\/portal)?\/?$/i)?.[1];
  if (!segmento) return null;
  try {
    const slug = decodeURIComponent(segmento).toLowerCase();
    if (slugPortalDoTutor(slug + ".oricse.com.br") !== slug) return null;
    return urlPortalDoTutor(slug) + search + hash;
  } catch {
    return null;
  }
}
