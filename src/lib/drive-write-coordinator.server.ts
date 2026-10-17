/**
 * A single Durable Object serializes operational Drive mutations across Worker
 * instances. No clinical, financial or customer records live in DO storage:
 * the sole persistent data store remains Google Drive.
 *
 * All writes are queued in one coordinator until a per-clinic partition is
 * implemented with cross-clinic transactional guarantees.
 */
import { DurableObject } from "cloudflare:workers";
import { executarDriveDbInterno } from "@/lib/drive-db.functions";
import { SerialWriteQueue } from "@/lib/serial-write-queue";
import { salvarEstadoOricseInterno } from "@/lib/oricse-storage.functions";

export class OricseWriteCoordinator extends DurableObject {
  private readonly writes = new SerialWriteQueue();

  async executeWrite(input: unknown): Promise<unknown> {
    return this.writes.run(async () => {
      try {
        if(input && typeof input==="object" && (input as any).kind==="state") return await salvarEstadoOricseInterno((input as any).input, true);
        return await executarDriveDbInterno(input as never, true);
      } catch (error: any) {
        return {
          data: null,
          error: { code: error?.code || "DRIVE_DB", message: error?.message || "Falha ao gravar no Google Drive.", field: error?.field, recordId: error?.recordId },
          count: null,
        };
      }
    });
  }
}
