import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const identidade = z.object({ accessToken: z.string().min(20), clinicaId: z.string().uuid() });

export const salvarOrcamentoRelatorio = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    identidade
      .extend({
        id: z.string().uuid(),
        totalCentavos: z.number().int().min(0).max(100_000_000),
        validadeDias: z.number().int().min(1).max(365),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { salvarOrcamento } = await import("./orcamentos-relatorio.server");
    return salvarOrcamento(data);
  });

export const vincularOrcamentoRelatorio = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    identidade
      .extend({ orcamentoId: z.string().trim().uuid(), vendaId: z.string().trim().uuid() })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { vincularOrcamento } = await import("./orcamentos-relatorio.server");
    return vincularOrcamento(data);
  });
