/**
 * Cloudflare Durable Object: single writer for all ORICSE Drive mutations.
 * Only coordination is held here. Clinical/financial records live exclusively
 * in the Google Drive files managed by the persistence functions.
 *
 * The classic fetch interface avoids client-side bundler imports of
 * cloudflare:workers and is available exclusively through a Worker binding.
 */
import { executarDriveDbInterno } from "@/lib/drive-db.functions";
import { salvarEstadoOricseInterno } from "@/lib/oricse-storage.functions";
import { SerialWriteQueue } from "@/lib/serial-write-queue";

export class OricseWriteCoordinator {
  private readonly writes = new SerialWriteQueue();
  private lastCommitMs = 0;

  async fetch(request: Request): Promise<Response> {
    if(request.method !== "POST" || new URL(request.url).pathname !== "/write") {
      return new Response("Not found", { status: 404 });
    }
    const payload = await request.json() as { kind?: string; input?: unknown };
    const result = await this.writes.run(async () => {
      try {
        if(payload.kind === "state") {
          return await salvarEstadoOricseInterno(payload.input as never, true);
        }
        if(payload.kind === "db") {
          this.lastCommitMs = Math.max(Date.now(), this.lastCommitMs + 1);
          return await executarDriveDbInterno(payload.input as never, true, new Date(this.lastCommitMs).toISOString());
        }
        throw new Error("Operação de coordenação inválida.");
      } catch (error: any) {
        return {
          data: null,
          error: {
            code: error?.code || "DRIVE_DB",
            message: error?.message || "Falha ao gravar no Google Drive.",
            field: error?.field,
            recordId: error?.recordId,
          },
          count: null,
        };
      }
    });
    return Response.json(result);
  }
}
