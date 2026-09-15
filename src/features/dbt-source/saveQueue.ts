export type DbtChanges = Record<string, string | null>;

export type SaveQueueState = "saving" | "saved" | "error";

/**
 * Serialises dbt file writes. Requests never overlap, so an older write can never land after a newer
 * one; changes queued while a write is in flight are merged (latest content per path wins) and sent
 * next. A failed write puts its paths back unless a newer change for the same path arrived meanwhile.
 */
export function createDbtSaveQueue(
  save: (changes: DbtChanges) => Promise<unknown>,
  onState: (state: SaveQueueState) => void = () => {},
) {
  let pending: DbtChanges = {};
  let running: Promise<void> | null = null;

  const drain = async (): Promise<void> => {
    while (Object.keys(pending).length) {
      const batch = pending;
      pending = {};
      onState("saving");
      try {
        await save(batch);
      } catch {
        pending = { ...batch, ...pending };
        onState("error");
        return;
      }
    }
    onState("saved");
  };

  return {
    enqueue(changes: DbtChanges): Promise<void> {
      if (Object.keys(changes).length) pending = { ...pending, ...changes };
      if (!running) {
        running = drain().finally(() => {
          running = null;
        });
      }
      return running;
    },
    /** Resolves when nothing is queued or in flight. */
    async idle(): Promise<void> {
      while (running) await running;
    },
    get pending(): DbtChanges {
      return { ...pending };
    },
  };
}
