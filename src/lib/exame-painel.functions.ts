import { createServerFn } from "@tanstack/react-start";
import {
  acessoLabSchema,
  referenciasLabSchema,
  salvarExameLabSchema,
  salvarReferenciasLabSchema,
} from "./exame-painel";

export const listarExamesLaboratoriais = createServerFn({ method: "POST" })
  .validator((i: unknown) => acessoLabSchema.parse(i))
  .handler(async ({ data }) =>
    (await import("./exame-painel.server")).listarExamesLabServidor(data),
  );

export const listarReferenciasLaboratoriais = createServerFn({ method: "POST" })
  .validator((i: unknown) => referenciasLabSchema.parse(i))
  .handler(async ({ data }) =>
    (await import("./exame-painel.server")).listarReferenciasLabServidor(data),
  );

export const salvarReferenciasLaboratoriais = createServerFn({ method: "POST" })
  .validator((i: unknown) => salvarReferenciasLabSchema.parse(i))
  .handler(async ({ data }) =>
    (await import("./exame-painel.server")).salvarReferenciasLabServidor(data),
  );

export const salvarExameLaboratorial = createServerFn({ method: "POST" })
  .validator((i: unknown) => salvarExameLabSchema.parse(i))
  .handler(async ({ data }) =>
    (await import("./exame-painel.server")).salvarExameLabServidor(data),
  );
