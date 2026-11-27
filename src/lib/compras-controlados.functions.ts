import { createServerFn } from "@tanstack/react-start";
import {
  listarComprasControladosSchema,
  listarProdutosCompraControladosSchema,
  salvarCompraControladoSchema,
} from "./compras-controlados";

export type { CompraControlado, ProdutoCompraControlado } from "./compras-controlados";

export const listarComprasControlados = createServerFn({ method: "POST" })
  .validator((input: unknown) => listarComprasControladosSchema.parse(input))
  .handler(async ({ data }) => {
    const { listarComprasControladosServidor } = await import("./compras-controlados.server");
    return listarComprasControladosServidor(data);
  });

export const listarProdutosCompraControlados = createServerFn({ method: "POST" })
  .validator((input: unknown) => listarProdutosCompraControladosSchema.parse(input))
  .handler(async ({ data }) => {
    const { listarProdutosCompraControladosServidor } =
      await import("./compras-controlados.server");
    return listarProdutosCompraControladosServidor(data);
  });

export const salvarCompraControlado = createServerFn({ method: "POST" })
  .validator((input: unknown) => salvarCompraControladoSchema.parse(input))
  .handler(async ({ data }) => {
    const { salvarCompraControladoServidor } = await import("./compras-controlados.server");
    return salvarCompraControladoServidor(data);
  });
