export type PerfilAdminClinica = "internacao" | "consultorio" | "recepcao" | "caixa";

export type ContextoAdminClinica = {
  clinicaId: string;
  clinicaNome: string;
  clinicaSlug: string;
  perfil: PerfilAdminClinica;
};

const CHAVE = "oricse:admin-clinic-context";

export function lerContextoAdminClinica(): ContextoAdminClinica | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.sessionStorage.getItem(CHAVE);
    if (!bruto) return null;
    const contexto = JSON.parse(bruto) as Partial<ContextoAdminClinica>;
    if (!contexto.clinicaId || !contexto.perfil) return null;
    return {
      clinicaId: String(contexto.clinicaId),
      clinicaNome: String(contexto.clinicaNome || ""),
      clinicaSlug: String(contexto.clinicaSlug || ""),
      perfil: contexto.perfil,
    };
  } catch {
    return null;
  }
}

export function salvarContextoAdminClinica(contexto: ContextoAdminClinica) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(CHAVE, JSON.stringify(contexto));
}

export function limparContextoAdminClinica() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CHAVE);
}
