import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { deleteDriveJson, driveAccessToken, readDriveJson, writeDriveJson } from "@/lib/drive-kv.server";

const codigoSchema = z.object({ codigo: z.string().regex(/^[0-9]{6}$/) });
const envioSchema = z.object({ dados: z.unknown().refine((v) => JSON.stringify(v ?? null).length < 2_000_000, { message: "Backup muito grande" }) });
const PATH = [".oricse", "transferencias"];

type Transferencia = { dados: unknown; expira_em: string };

export const enviarTransferencia = createServerFn({ method: "POST" })
  .validator((input: unknown) => envioSchema.parse(input))
  .handler(async ({ data }) => {
    const token = await driveAccessToken();
    for (let tentativa = 0; tentativa < 8; tentativa += 1) {
      const codigo = String(Math.floor(100000 + Math.random() * 900000));
      const existente = await readDriveJson<Transferencia | null>(token, PATH, `${codigo}.json`, null);
      if (existente.fileId && existente.value && new Date(existente.value.expira_em).getTime() > Date.now()) continue;
      await writeDriveJson(token, PATH, `${codigo}.json`, { dados: data.dados, expira_em: new Date(Date.now() + 30 * 60_000).toISOString() });
      return { codigo };
    }
    throw new Error("Não foi possível gerar um código. Tente novamente.");
  });

export const buscarTransferencia = createServerFn({ method: "POST" })
  .validator((input: unknown) => codigoSchema.parse(input))
  .handler(async ({ data }): Promise<{ json: string | null }> => {
    const token = await driveAccessToken();
    const { value } = await readDriveJson<Transferencia | null>(token, PATH, `${data.codigo}.json`, null);
    if (!value) return { json: null };
    if (new Date(value.expira_em).getTime() < Date.now()) { await deleteDriveJson(token, PATH, `${data.codigo}.json`); return { json: null }; }
    return { json: JSON.stringify(value.dados) };
  });

export const apagarTransferencia = createServerFn({ method: "POST" })
  .validator((input: unknown) => codigoSchema.parse(input))
  .handler(async ({ data }) => {
    const token = await driveAccessToken();
    await deleteDriveJson(token, PATH, `${data.codigo}.json`);
    return { ok: true };
  });
