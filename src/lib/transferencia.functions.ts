import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const codigoSchema = z.object({ codigo: z.string().regex(/^[0-9]{6}$/) });
const envioSchema = z.object({
  dados: z.unknown().refine((v) => JSON.stringify(v ?? null).length < 2_000_000, {
    message: "Backup muito grande",
  }),
});

/** Envia o backup para a nuvem e devolve o código curto usado no QR. */
export const enviarTransferencia = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => envioSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("transferencias").delete().lt("expira_em", new Date().toISOString());

    for (let tentativa = 0; tentativa < 6; tentativa += 1) {
      const codigo = String(Math.floor(100000 + Math.random() * 900000));
      const { error } = await supabaseAdmin
        .from("transferencias")
        .insert({ codigo, dados: data.dados as never });
      if (!error) return { codigo };
      if (error.code !== "23505") throw new Error("Não foi possível enviar o backup.");
    }
    throw new Error("Não foi possível gerar um código. Tente novamente.");
  });

/** Busca o backup pelo código. Devolve null quando não existe ou expirou. */
export const buscarTransferencia = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => codigoSchema.parse(input))
  .handler(async ({ data }): Promise<{ json: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: linha } = await supabaseAdmin
      .from("transferencias")
      .select("dados, expira_em")
      .eq("codigo", data.codigo)
      .maybeSingle();
    if (!linha) return { json: null };
    if (new Date(linha.expira_em).getTime() < Date.now()) return { json: null };
    return { json: JSON.stringify(linha.dados) };
  });

/** Apaga o backup enviado. */
export const apagarTransferencia = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => codigoSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("transferencias").delete().eq("codigo", data.codigo);
    return { ok: true };
  });
