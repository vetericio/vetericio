export type DriveModo = "oricse" | "personalizado";

export type DriveCategoria =
  | "identidade"
  | "tutores"
  | "animais"
  | "exames"
  | "receitas"
  | "documentos"
  | "imagens"
  | "backups"
  | "portal-tutor"
  | "outros";

export const PASTAS_DRIVE: Record<DriveCategoria, string> = {
  identidade: "Identidade",
  tutores: "Tutores",
  animais: "Animais",
  exames: "Exames",
  receitas: "Receitas",
  documentos: "Documentos",
  imagens: "Imagens",
  backups: "Backups",
  "portal-tutor": "Portal do Tutor",
  outros: "Outros",
};

export interface ClinicaDriveConfig {
  clinica_id: string;
  modo: DriveModo;
  root_folder_id: string | null;
  root_folder_url: string | null;
  status: "pendente" | "conectado" | "erro";
  verificado_em: string | null;
}

/** Extrai o ID de uma pasta a partir do ID puro ou de uma URL do Google Drive. */
export function extrairDriveFolderId(valor: string): string | null {
  const texto = valor.trim();
  if (!texto) return null;

  if (/^[A-Za-z0-9_-]{10,}$/.test(texto) && !texto.includes("/")) return texto;

  const porFolders = texto.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if (porFolders?.[1]) return porFolders[1];

  try {
    const url = new URL(texto);
    const id = url.searchParams.get("id");
    return id && /^[A-Za-z0-9_-]{10,}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Regra única do sistema:
 * - sem configuração própria: usa o Drive central da ORICSE;
 * - com modo personalizado conectado: usa a pasta da clínica.
 */
export function resolverPastaRaiz(
  config: ClinicaDriveConfig | null | undefined,
  pastaPadraoClinica: string,
): string {
  if (config?.modo === "personalizado" && config.status === "conectado" && config.root_folder_id) {
    return config.root_folder_id;
  }
  return pastaPadraoClinica;
}
