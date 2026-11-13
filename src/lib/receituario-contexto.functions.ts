import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  accessToken: z.string().min(20),
  animalId: z.string().uuid().optional(),
  tutorId: z.string().uuid().optional(),
});

/** Dados da clínica e do paciente resolvidos exclusivamente no servidor, com vínculo autorizado. */
export const obterDadosReceituario = createServerFn({ method: "POST" })
  .validator((valor: unknown) => schema.parse(valor))
  .handler(async ({ data }) => {
    const { resolverDadosReceituario } = await import("@/lib/receituario-contexto.server");
    return resolverDadosReceituario(data);
  });
