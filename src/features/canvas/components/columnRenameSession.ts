/** Survives TableNode remounts (RF `onlyRenderVisibleElements` / selection rebuild). */

export type RenameDraft = {
  column: string;
  draft: string;
};

const drafts = new Map<string, RenameDraft>();

const NODE_TESTID_PREFIX = "rf__node-";

export function getRenameDraft(tableId: string): RenameDraft | undefined {
  return drafts.get(tableId);
}

export function setRenameDraft(tableId: string, draft: RenameDraft): void {
  drafts.set(tableId, draft);
}

export function clearRenameDraft(tableId: string): void {
  drafts.delete(tableId);
}

export function resetRenameDraftsForTests(): void {
  drafts.clear();
}

export function armRenameFromPointerEvent(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const btn = target.closest("[data-testid='col-rename']");
  if (!btn) return;
  const column = btn.getAttribute("data-col-name");
  const node = btn.closest(`[data-testid^='${NODE_TESTID_PREFIX}']`);
  const testId = node?.getAttribute("data-testid") ?? "";
  if (!column || !testId.startsWith(NODE_TESTID_PREFIX)) return;
  const tableId = testId.slice(NODE_TESTID_PREFIX.length);
  if (!tableId) return;
  drafts.set(tableId, { column, draft: column });
}

let retainers = 0;

export function retainRenamePointerArm(): () => void {
  if (typeof document === "undefined") return () => {};
  if (retainers === 0) {
    document.addEventListener("pointerdown", armRenameFromPointerEvent, true);
  }
  retainers += 1;
  return () => {
    retainers -= 1;
    if (retainers === 0) {
      document.removeEventListener("pointerdown", armRenameFromPointerEvent, true);
    }
  };
}
