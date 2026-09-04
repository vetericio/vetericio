import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const codigoSchema = z.object({ codigo: z.string().regex(/^[A-Z][0-9]{5}$/) });
const envioSchema = z.object({
  codigo: z.string().regex(/^[A-Z][0-9]{5}$/),
  dados: z.unknown().refine((v) => JSON.stringify(v ?? null).length < 4_000_000, {
    message: "Dados muito grandes",
  }),
});

const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function novoCodigo(): string {
  const letra = LETRAS[Math.floor(Math.random() * LETRAS.length)] ?? "A";
  return `${letra}${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`;
}

/** Cria o vínculo e devolve o código (1 letra + 5 números). */
export const criarSala = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  for (let tentativa = 0; tentativa < 8; tentativa += 1) {
    const codigo = novoCodigo();
    const { error } = await supabaseAdmin
      .from("sync_salas")
      .insert({ codigo_hash: codigo, dados: {} as never });
    if (!error) return { codigo };
    if (error.code !== "23505") throw new Error(`Falha do servidor: ${error.message}`);
  }
  throw new Error("Não foi possível gerar um código. Tente novamente.");
});

/** Envia os dados deste aparelho para o vínculo. */
export const enviarSala = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => envioSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("sync_salas").upsert(
      {
        codigo_hash: data.codigo,
        dados: data.dados as never,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "codigo_hash" },
    );
    if (error) throw new Error(`Falha do servidor: ${error.message}`);
    return { ok: true };
  });

/** Traz os dados do vínculo. Devolve json nulo quando a sala está vazia. */
export const puxarSala = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => codigoSchema.parse(input))
  .handler(async ({ data }): Promise<{ json: string | null; atualizadoEm: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: linha } = await supabaseAdmin
      .from("sync_salas")
      .select("dados, atualizado_em")
      .eq("codigo_hash", data.codigo)
      .maybeSingle();
    if (!linha) return { json: null, atualizadoEm: null };
    const dados = linha.dados as unknown;
    const vazio =
      !dados || (typeof dados === "object" && Object.keys(dados as object).length === 0);
    if (vazio) return { json: null, atualizadoEm: linha.atualizado_em };
    return { json: JSON.stringify(dados), atualizadoEm: linha.atualizado_em };
  });

/** Desfaz o vínculo, apagando os dados guardados na nuvem. */
export const apagarSala = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => codigoSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("sync_salas").delete().eq("codigo_hash", data.codigo);
    return { ok: true };
  });
