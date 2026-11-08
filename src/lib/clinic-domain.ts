export type DomainRow = {
  id: string;
  clinica_id: string;
  hostname: string;
  status: string;
  publicar_site: boolean;
  atualizado_em?: string | null;
};

export function normalizeDomain(hostname: string) {
  return hostname.trim().toLowerCase();
}

export function uniqueClinicDomains<T extends DomainRow>(rows: T[], clinicId: string): T[] {
  const byHost = new Map<string, T>();
  const score = (row: T) => Number(row.status === "ativo" && row.publicar_site);
  const updated = (row: T) => Date.parse(row.atualizado_em || "") || 0;
  for (const row of rows) {
    if (row.clinica_id !== clinicId) continue;
    const key = normalizeDomain(row.hostname);
    const previous = byHost.get(key);
    if (!previous || score(row) > score(previous) ||
      (score(row) === score(previous) && (updated(row) > updated(previous) ||
        (updated(row) === updated(previous) && row.id.localeCompare(previous.id) < 0)))) {
      byHost.set(key, row);
    }
  }
  return [...byHost.values()].sort((a, b) => normalizeDomain(a.hostname).localeCompare(normalizeDomain(b.hostname)));
}

export type DomainReachability = "ativo" | "indisponivel" | "nao_verificado";
export function domainOnlineLabel(row: Pick<DomainRow, "status" | "publicar_site">, check?: DomainReachability | "verificando") {
  if (!row.publicar_site || row.status !== "ativo") return "Aguardando ativação";
  if (check === "ativo") return "● Ativo";
  if (check === "verificando") return "Verificando";
  if (check === "indisponivel") return "Indisponível";
  return "Não verificado";
}

export function safeOricseHostname(host: string) {
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+oricse\.com\.br$/.test(host) && host.length <= 253;
}

// Only the platform-controlled namespace is probed. Custom domains remain
// unverified until a DNS/IP validation mechanism can prevent SSRF/rebinding.
export async function checkOricseHttps(host: string, fetcher: typeof fetch = fetch): Promise<DomainReachability> {
  if (!safeOricseHostname(host)) return "nao_verificado";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    let url = new URL(`https://${host}/`);
    for (let hop = 0; hop < 4; hop++) {
      const response = await fetcher(url, { method: "GET", redirect: "manual", signal: controller.signal });
      await response.body?.cancel();
      if (response.status >= 200 && response.status < 300) return "ativo";
      if (response.status < 300 || response.status >= 400) return "indisponivel";
      const location = response.headers.get("location");
      if (!location) return "nao_verificado";
      const next = new URL(location, url);
      if (next.protocol !== "https:" || next.username || next.password ||
        (next.port && next.port !== "443") || !safeOricseHostname(next.hostname)) return "nao_verificado";
      url = next;
    }
    return "nao_verificado";
  } catch {
    // Network/TLS failures do not prove a site is permanently offline.
    return "nao_verificado";
  } finally {
    clearTimeout(timer);
  }
}