type CoordinatorStub = { fetch(request: Request): Promise<Response> };
type CoordinatorNamespace = {
  idFromName(name: string): unknown;
  get(id: unknown): CoordinatorStub;
};

// Runtime binding, not application data. The Worker entrypoint supplies the
// same Cloudflare namespace for every request handled by this isolate.
let namespace: CoordinatorNamespace | null = null;

export function setDriveCoordinatorBinding(value: unknown) {
  namespace = value && typeof (value as any).idFromName === "function" && typeof (value as any).get === "function"
    ? value as CoordinatorNamespace
    : null;
}

export async function executarEscritaCoordenada(kind: "db" | "state", input: unknown): Promise<any> {
  if (!namespace) {
    throw new Error("Coordenação de escrita Cloudflare não configurada. Nenhum dado foi alterado.");
  }
  const stub = namespace.get(namespace.idFromName("oricse-drive-writes-v1"));
  const response = await stub.fetch(new Request("https://oricse.internal/write", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, input }),
  }));
  if (!response.ok) throw new Error("Coordenador de escrita indisponível: HTTP " + response.status);
  return await response.json();
}
