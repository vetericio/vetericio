export type PerfilAdminClinica = "internacao" | "consultorio" | "recepcao" | "caixa";

export type ContextoAdminClinica = {
  clinicaId: string;
  clinicaNome: string;
  clinicaSlug: string;
  perfil: PerfilAdminClinica;
};

// Contexto transitório da aba; nunca persistido no armazenamento do navegador.
// A identidade/autorização real continua sendo validada pelo backend.
let contextoAtual: ContextoAdminClinica | null = null;

export function lerContextoAdminClinica(): ContextoAdminClinica | null {
  if (typeof window === "undefined") return null;
  return contextoAtual ? { ...contextoAtual } : null;
}

export function salvarContextoAdminClinica(contexto: ContextoAdminClinica) {
  if (typeof window === "undefined") return;
  contextoAtual = { ...contexto };
}

export function limparContextoAdminClinica() {
  contextoAtual = null;
}
