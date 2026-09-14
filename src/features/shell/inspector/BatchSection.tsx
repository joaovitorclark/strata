import { useTranslation } from "react-i18next";

import { TABLE_COLORS } from "@/features/canvas/tableColors";
import { setTableColor, setTableLayer, setTablesHidden } from "@/features/schema/model/edit";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";

import { FOCUS } from "./types";
import type { InspectorProps } from "./types";

type BatchSectionProps = {
  tableIds: string[];
  layers: InspectorProps["layers"];
  dbml?: string;
  onApply?: (next: string) => void;
  onSetLayer?: InspectorProps["onSetLayer"];
  onSetColor: InspectorProps["onSetColor"];
  onRemoveTables?: InspectorProps["onRemoveTables"];
};

export function BatchSection({
  tableIds,
  layers,
  dbml,
  onApply,
  onSetLayer,
  onSetColor,
  onRemoveTables,
}: BatchSectionProps) {
  const { t } = useTranslation();
  const setHiddenTables = useSchemaStore((s) => s.setHiddenTables);
  const hiddenTableIds = useSchemaStore((s) => s.hiddenTableIds);
  const n = tableIds.length;

  const applyAll = (next: string) => {
    onApply?.(next);
  };

  const setLayer = (layerId: string | null) => {
    const color = layers.find((l) => l.id === layerId)?.color;
    if (dbml && onApply) {
      applyAll(tableIds.reduce((acc, id) => setTableLayer(acc, id, layerId, color), dbml));
      return;
    }
    tableIds.forEach((id) => onSetLayer?.(id, layerId));
  };

  const setColor = (color: string | null) => {
    if (dbml && onApply) {
      applyAll(tableIds.reduce((acc, id) => setTableColor(acc, id, color), dbml));
      return;
    }
    tableIds.forEach((id) => onSetColor(id, color));
  };

  const hide = () => {
    if (dbml && onApply) applyAll(setTablesHidden(dbml, tableIds, true));
    setHiddenTables([...new Set([...hiddenTableIds, ...tableIds])]);
  };

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <p data-testid="inspector-multi" className="text-sm font-medium text-foreground">
        {t("shell.inspector.multiSelected", { count: n })}
      </p>

      <label className="grid gap-1">
        <span className="text-[11px] font-medium text-muted-foreground">
          {t("shell.inspector.batchLayer")}
        </span>
        <select
          data-testid="inspector-batch-layer"
          aria-label={t("shell.inspector.batchLayer")}
          className="h-8 rounded-md border border-input bg-background px-2 font-mono text-xs"
          defaultValue=""
          onChange={(event) => setLayer(event.target.value || null)}
        >
          <option value="">{t("shell.inspector.noLayer")}</option>
          {layers.map((layer) => (
            <option key={layer.id} value={layer.id}>
              {layer.name}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="text-[11px] font-medium text-muted-foreground">
          {t("shell.inspector.batchColour")}
        </span>
        <div className="mt-1 grid grid-cols-6 gap-1">
          {TABLE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => setColor(c)}
              className={cn(FOCUS, "size-4 rounded-sm ring-1 ring-border")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setColor(null)}
          className={cn(FOCUS, "mt-1 text-[11px] text-muted-foreground hover:text-foreground")}
        >
          {t("shell.inspector.noColour")}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="inspector-batch-hide"
          className={cn(FOCUS, "rounded-md border border-border px-2 py-1 text-xs")}
          onClick={hide}
        >
          {t("shell.inspector.batchHide")}
        </button>
        <button
          type="button"
          data-testid="inspector-batch-remove"
          className={cn(
            FOCUS,
            "rounded-md border border-destructive px-2 py-1 text-xs text-destructive",
          )}
          onClick={() => {
            if (confirm(t("shell.inspector.batchRemoveConfirm", { count: n }))) {
              onRemoveTables?.(tableIds);
            }
          }}
        >
          {t("shell.inspector.batchRemove")}
        </button>
      </div>
    </div>
  );
}
