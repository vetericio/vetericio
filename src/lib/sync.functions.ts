import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Códigos curtos novos (letra + 6 números) e os longos já em uso. */
const codigoSchema = z.string().regex(/^([a-z][0-9]{6}|[a-z0-9]{16,64})$/);

const puxarSchema = z.object({ codigo: codigoSchema });
const enviarSchema = z.object({
  codigo: codigoSchema,
  dadosJson: z.string().max(4_000_000),
});

/** O código secreto nunca é guardado: só o resumo (hash) dele. */
async function hashCodigo(codigo: string): Promise<string> {
  const bytes = new TextEncoder().encode(`veterico-sync:${codigo}`);
  const resumo = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(resumo))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Baixa os dados guardados para este código. */
export const puxarSala = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => puxarSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hash = await hashCodigo(data.codigo);
    const { data: linha, error } = await supabaseAdmin
      .from("sync_salas")
      .select("dados, atualizado_em")
      .eq("codigo_hash", hash)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      /** JSON já serializado, para atravessar a chamada com segurança. */
      dadosJson: linha?.dados ? JSON.stringify(linha.dados) : null,
      atualizadoEm: (linha?.atualizado_em ?? null) as string | null,
    };
  });

/** Sobe os dados deste aparelho para o código. */
export const enviarSala = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => enviarSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hash = await hashCodigo(data.codigo);
    const atualizadoEm = new Date().toISOString();
    const { error } = await supabaseAdmin.from("sync_salas").upsert(
      {
        codigo_hash: hash,
        dados: JSON.parse(data.dadosJson) as never,
        atualizado_em: atualizadoEm,
      },
      { onConflict: "codigo_hash" },
    );
    if (error) throw new Error(error.message);
    return { atualizadoEm };
  });
