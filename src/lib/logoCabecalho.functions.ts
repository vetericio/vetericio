import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CHAVE_GLOBAL = "__VETERICIO_LOGO_CABECALHO_GLOBAL__";
const logoSchema = z.object({
  logo: z.string().max(2_000_000).refine(
    (v) => v === "" || /^data:image\/(png|jpeg);base64,/.test(v),
    "Formato de imagem inválido",
  ),
});

export const buscarLogoCabecalhoGlobal = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("sync_salas")
    .select("dados")
    .eq("codigo_hash", CHAVE_GLOBAL)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar logo: ${error.message}`);
  const dados = data?.dados as { logo?: unknown } | null;
  return { logo: typeof dados?.logo === "string" ? dados.logo : "" };
});

export const salvarLogoCabecalhoGlobal = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => logoSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.logo) {
      const { error } = await supabaseAdmin
        .from("sync_salas")
        .delete()
        .eq("codigo_hash", CHAVE_GLOBAL);
      if (error) throw new Error(`Falha ao restaurar logo: ${error.message}`);
      return { ok: true };
    }
    const { error } = await supabaseAdmin.from("sync_salas").upsert(
      {
        codigo_hash: CHAVE_GLOBAL,
        dados: { logo: data.logo } as never,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "codigo_hash" },
    );
    if (error) throw new Error(`Falha ao salvar logo: ${error.message}`);
    return { ok: true };
  });
