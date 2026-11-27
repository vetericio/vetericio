import { exigirClinicaNoPilotoRelatorios } from "./relatorios-acesso";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { exigirPermissaoClinica } from "@/lib/permissao-clinica.server";
import { contaDemoAlvorada, exigirEmissaoDisponivel } from "@/lib/demo-alvorada";
import { diaNoFuso, somarDias } from "./relatorios";

type Identidade = { accessToken: string; clinicaId: string };

async function autorizar({ accessToken, clinicaId }: Identidade, permissoes: string[]) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Sessão inválida. Entre novamente.");
  exigirEmissaoDisponivel(contaDemoAlvorada(data.user));
  await exigirPermissaoClinica(supabaseAdmin, data.user.id, clinicaId, permissoes, accessToken);
  await exigirClinicaNoPilotoRelatorios(supabaseAdmin, clinicaId, data.user.id);
  return data.user.id;
}

export async function salvarOrcamento(
  input: Identidade & { id: string; totalCentavos: number; validadeDias: number },
) {
  const autor = await autorizar(input, ["caixa.comandas", "caixa.financeiro.gerenciar"]);
  const { clinicaId, id, totalCentavos, validadeDias } = input;
  const validade = somarDias(diaNoFuso(new Date().toISOString()), validadeDias);
  const { error } = await supabaseAdmin.from("oricse_relatorio_orcamentos").upsert(
    {
      id,
      clinica_id: clinicaId,
      valor_centavos: totalCentavos,
      validade_em: validade,
      criado_por: autor,
    },
    { onConflict: "clinica_id,id", ignoreDuplicates: true },
  );
  if (error) throw new Error("Não foi possível guardar a referência do orçamento.");
  const { data, error: leitura } = await supabaseAdmin
    .from("oricse_relatorio_orcamentos")
    .select("id,valor_centavos,criado_por")
    .eq("id", id)
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (leitura || !data || data.criado_por !== autor || data.valor_centavos !== totalCentavos)
    throw new Error("A referência do orçamento já pertence a outro registro.");
  return { id };
}

export async function vincularOrcamento(
  input: Identidade & { orcamentoId: string; vendaId: string },
) {
  await autorizar(input, ["caixa.financeiro.gerenciar"]);
  const { clinicaId, orcamentoId, vendaId } = input;
  const [o, v] = await Promise.all([
    supabaseAdmin
      .from("oricse_relatorio_orcamentos")
      .select("id,criado_em,venda_id")
      .eq("id", orcamentoId)
      .eq("clinica_id", clinicaId)
      .maybeSingle(),
    supabaseAdmin
      .from("oricse_vendas_expressas")
      .select("id,registrada_em")
      .eq("id", vendaId)
      .eq("clinica_id", clinicaId)
      .maybeSingle(),
  ]);
  if (o.error || v.error || !o.data || !v.data)
    throw new Error("Orçamento ou venda não encontrados nesta clínica.");
  if (o.data.venda_id === vendaId) return { ok: true };
  if (o.data.venda_id || Date.parse(v.data.registrada_em) < Date.parse(o.data.criado_em)) {
    throw new Error(
      "Confira se a venda é posterior ao orçamento e se ele ainda não foi vinculado.",
    );
  }
  const { data, error } = await supabaseAdmin
    .from("oricse_relatorio_orcamentos")
    .update({ venda_id: vendaId, vinculado_em: new Date().toISOString() })
    .eq("clinica_id", clinicaId)
    .eq("id", orcamentoId)
    .is("venda_id", null)
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw new Error(
      "Não foi possível vincular. Confira se a venda já foi usada em outro orçamento.",
    );
  return { ok: true };
}
