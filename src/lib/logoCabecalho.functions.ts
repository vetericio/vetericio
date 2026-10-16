import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { deleteDriveJson, driveAccessToken, readDriveJson, writeDriveJson } from "@/lib/drive-kv.server";

const logoSchema = z.object({
  logo: z.string().max(2_000_000).refine((v) => v === "" || /^data:image\/(png|jpeg);base64,/.test(v), "Formato de imagem inválido"),
});
const PATH = [".oricse", "config"];
const ARQUIVO = "logo-cabecalho.json";

export const buscarLogoCabecalhoGlobal = createServerFn({ method: "GET" }).handler(async () => {
  const token = await driveAccessToken();
  const { value } = await readDriveJson<{ logo?: string }>(token, PATH, ARQUIVO, {});
  return { logo: typeof value?.logo === "string" ? value.logo : "" };
});

export const salvarLogoCabecalhoGlobal = createServerFn({ method: "POST" })
  .validator((input: unknown) => logoSchema.parse(input))
  .handler(async ({ data }) => {
    const token = await driveAccessToken();
    if (!data.logo) await deleteDriveJson(token, PATH, ARQUIVO);
    else await writeDriveJson(token, PATH, ARQUIVO, { logo: data.logo, atualizado_em: new Date().toISOString() });
    return { ok: true };
  });
