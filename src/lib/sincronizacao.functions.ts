import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { deleteDriveJson, driveAccessToken, readDriveJson, writeDriveJson } from "@/lib/drive-kv.server";

const authSchema = z.object({ accessToken: z.string().min(20) });
const codigoSchema = authSchema.extend({ codigo: z.string().regex(/^[A-Z][0-9]{5}$/) });
const envioSchema = authSchema.extend({ codigo: z.string().regex(/^[A-Z][0-9]{5}$/), dados: z.unknown().refine((v) => JSON.stringify(v ?? null).length < 4_000_000, { message: "Dados muito grandes" }) });
const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PATH = [".oricse", "sincronizacao"];

function novoCodigo(): string { const letra = LETRAS[Math.floor(Math.random() * LETRAS.length)] ?? "A"; return `${letra}${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`; }

type Sala = { dados: unknown; atualizado_em: string };

async function validarSessao(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Sessão expirada.");
}

export const criarSala = createServerFn({ method: "POST" })
  .validator((input: unknown) => authSchema.parse(input))
  .handler(async ({ data }) => {
  await validarSessao(data.accessToken);
  const token = await driveAccessToken();
  for (let tentativa = 0; tentativa < 8; tentativa += 1) {
    const codigo = novoCodigo();
    const existente = await readDriveJson<Sala | null>(token, PATH, `${codigo}.json`, null);
    if (existente.fileId) continue;
    await writeDriveJson(token, PATH, `${codigo}.json`, { dados: {}, atualizado_em: new Date().toISOString() });
    return { codigo };
  }
  throw new Error("Não foi possível gerar um código. Tente novamente.");
});

export const enviarSala = createServerFn({ method: "POST" })
  .validator((input: unknown) => envioSchema.parse(input))
  .handler(async ({ data }) => {
    await validarSessao(data.accessToken);
    const token = await driveAccessToken();
    await writeDriveJson(token, PATH, `${data.codigo}.json`, { dados: data.dados, atualizado_em: new Date().toISOString() });
    return { ok: true };
  });

export const puxarSala = createServerFn({ method: "POST" })
  .validator((input: unknown) => codigoSchema.parse(input))
  .handler(async ({ data }): Promise<{ json: string | null; atualizadoEm: string | null }> => {
    await validarSessao(data.accessToken);
    const token = await driveAccessToken();
    const { value } = await readDriveJson<Sala | null>(token, PATH, `${data.codigo}.json`, null);
    if (!value) return { json: null, atualizadoEm: null };
    const vazio = !value.dados || (typeof value.dados === "object" && Object.keys(value.dados as object).length === 0);
    return { json: vazio ? null : JSON.stringify(value.dados), atualizadoEm: value.atualizado_em || null };
  });

export const apagarSala = createServerFn({ method: "POST" })
  .validator((input: unknown) => codigoSchema.parse(input))
  .handler(async ({ data }) => {
    await validarSessao(data.accessToken);
    const token = await driveAccessToken();
    await deleteDriveJson(token, PATH, `${data.codigo}.json`);
    return { ok: true };
  });
