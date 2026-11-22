/**
 * Liberação controlada do piloto de Gestão de Clientes.
 * Enquanto o módulo estiver em validação, apenas a clínica Veterício o utiliza.
 */
export const CRM_CLINICA_PILOTO_SLUG = "vetericio";

export function crmLiberadoParaClinica(clinicaSlug?: string | null) {
  return String(clinicaSlug || "").trim().toLowerCase() === CRM_CLINICA_PILOTO_SLUG;
}
