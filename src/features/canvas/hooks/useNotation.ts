import { useCallback, useSyncExternalStore } from "react";

import { useSchemaStore } from "@/features/schema/store";
import {
  DEFAULT_NOTATION,
  readNotation,
  writeNotation,
  type Notation,
} from "@/features/canvas/utils/notation";

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function useNotation(): [Notation, (next: Notation) => void] {
  const projectId = useSchemaStore((s) => s.currentProjectId);
  const notation = useSyncExternalStore(
    subscribe,
    () => readNotation(projectId),
    () => DEFAULT_NOTATION,
  );
  const setNotation = useCallback(
    (next: Notation) => {
      writeNotation(projectId, next);
      emit();
    },
    [projectId],
  );
  return [notation, setNotation];
}
