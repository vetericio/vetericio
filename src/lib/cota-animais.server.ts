import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Verifica a cota coletiva considerando os IDs já registrados no PostgreSQL
 * e os IDs de uma fonte operacional legada (Drive ou módulo JSON).
 * Nunca usa quantidade por usuário; a chave é sempre clinica_id.
 */
export async function validarCotaAnimaisClinica(args: {
  clinicaId: string;
  existentes: string[];
  propostos: string[];
}) {
  if (!args.propostos.length) return;
  const { data: clinica, error: erroClinica } = await supabaseAdmin
    .from("clinicas").select("plano").eq("id", args.clinicaId).maybeSingle();
  if (erroClinica || !clinica) throw new Error("Não foi possível conferir o plano desta clínica.");

  const { data: cotas, error: erroCotas } = await (supabaseAdmin as any)
    .from("oricse_planos_limites").select("plano_codigo,plano_nome,limite_animais");
  if (erroCotas) throw new Error("Não foi possível verificar o limite de animais do plano.");
  const plano = String(clinica.plano || "");
  const cota = (cotas || []).find((c: any) => c.plano_codigo === plano) ||
    (cotas || []).find((c: any) => c.plano_nome === plano);
  const limite = cota?.limite_animais == null ? null : Number(cota.limite_animais);
  if (limite === null) return; // Planos antigos continuam ilimitados até configurados.

  const idsSql = new Set<string>();
  // Paginação explícita: PostgREST limita por padrão o número de linhas.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin.from("oricse_animais")
      .select("id").eq("clinica_id", args.clinicaId).range(offset, offset + 999);
    if (error) throw new Error("Não foi possível contar os animais da clínica.");
    for (const item of data || []) idsSql.add(String(item.id));
    if (!data || data.length < 1000) break;
  }

  const anteriores = new Set([...idsSql, ...args.existentes.filter(Boolean)]);
  const posteriores = new Set([...anteriores, ...args.propostos.filter(Boolean)]);
  const novos = posteriores.size - anteriores.size;
  // A edição e a redução de plano nunca apagam ou bloqueiam registros antigos.
  if (novos > 0 && posteriores.size > limite) {
    throw new Error(
      `Limite de ${limite} animais do plano atingido para esta clínica (${anteriores.size} já cadastrados). ` +
      "O limite é compartilhado por todos os funcionários. Solicite a ampliação do plano.",
    );
  }
}
