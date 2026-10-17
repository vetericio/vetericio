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

export class OricseWriteCoordinator extends DurableObject {
  private tail: Promise<void> = Promise.resolve();

  async executeWrite(input: unknown): Promise<unknown> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      // Server-side authorization is executed inside the serialized section.
      return await executarDriveDbInterno(input as never, true);
    } finally {
      release();
    }
  }
}
