import type { SupabaseClient } from "@supabase/supabase-js";
import { vetericioBrand } from "./vetericio-brand.ts";

export const SLUG_PILOTO_RELATORIOS = vetericioBrand.slug;
export const AVISO_PILOTO_RELATORIOS = "Relatórios disponíveis somente para a Veterício.";

export function clinicaNoPilotoRelatorios(slug?: string | null) {
  return slug === SLUG_PILOTO_RELATORIOS;
}

/** Clínica e vínculo vêm do banco. Nem administrador da plataforma sem vínculo entra no piloto. */
export async function exigirClinicaNoPilotoRelatorios(
  admin: Pick<SupabaseClient, "from">,
  clinicaId: string,
  userId: string,
) {
  if (!clinicaId || !userId) throw new Error(AVISO_PILOTO_RELATORIOS);
  const clinica = await admin.from("clinicas").select("slug").eq("id", clinicaId).maybeSingle();
  if (clinica.error || !clinicaNoPilotoRelatorios(clinica.data?.slug)) {
    throw new Error(AVISO_PILOTO_RELATORIOS);
  }
  const vinculo = await admin
    .from("clinica_usuarios")
    .select("user_id")
    .eq("clinica_id", clinicaId)
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();
  if (vinculo.error || vinculo.data?.user_id !== userId) throw new Error(AVISO_PILOTO_RELATORIOS);
}
