import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CODIGOS_FINANCEIROS, periodoValido } from "./relatorios";

export const consultarRelatorio = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        accessToken: z.string().min(20),
        clinicaId: z.string().uuid(),
        codigo: z.enum(CODIGOS_FINANCEIROS),
        inicio: z.string(),
        fim: z.string(),
      })
      .refine(
        ({ inicio, fim }) => periodoValido(inicio, fim),
        "Escolha um período válido de até 93 dias.",
      )
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { gerarRelatorio } = await import("./relatorios.server");
    return gerarRelatorio(data);
  });
