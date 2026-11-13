import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { exigirPermissaoClinica } from "@/lib/permissao-clinica.server";
import { MODELO_CONVITE_PADRAO, modeloConviteValido, LIMITE_MODELO_CONVITE } from "@/lib/convite-portal-tutor";

const clinicaSchema = z.object({ accessToken: z.string().min(20), clinicaId: z.string().uuid() });
const modeloSchema = z.string().trim().max(LIMITE_MODELO_CONVITE)
  .refine(modeloConviteValido, "Inclua todos os campos obrigatórios usando os botões do editor.");

async function contexto({ accessToken, clinicaId }: z.infer<typeof clinicaSchema>) {
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Sessão expirada. Entre novamente.");
  await exigirPermissaoClinica(admin, data.user.id, clinicaId, ["portal_tutor.gerenciar"], accessToken);
  return { admin, chave: `portal_tutor:modelo_convite:${clinicaId}` };
}

export const obterModeloConvite = createServerFn({ method: "POST" })
  .validator((input: unknown) => clinicaSchema.parse(input))
  .handler(async ({ data }) => {
    const { admin, chave } = await contexto(data);
    const { data: config, error } = await admin.from("oricse_config")
      .select("valor").eq("chave", chave).maybeSingle();
    if (error) throw new Error("Não foi possível carregar a mensagem da clínica.");
    const texto = modeloSchema.safeParse(config?.valor);
    return { modelo: texto.success ? texto.data : MODELO_CONVITE_PADRAO };
  });

export const salvarModeloConvite = createServerFn({ method: "POST" })
  .validator((input: unknown) => clinicaSchema.extend({ modelo: modeloSchema }).parse(input))
  .handler(async ({ data }) => {
    const { admin, chave } = await contexto(data);
    const { error } = await admin.from("oricse_config").upsert({
      chave, valor: data.modelo, updated_at: new Date().toISOString(),
    }, { onConflict: "chave" });
    if (error) throw new Error("Não foi possível salvar a mensagem da clínica.");
    return { modelo: data.modelo };
  });
