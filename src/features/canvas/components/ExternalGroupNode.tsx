import { memo, type CSSProperties } from "react";
import { Handle, Position } from "@xyflow/react";
import { ChevronRight } from "lucide-react";
import { EXTERNAL_SOURCE_HANDLE, EXTERNAL_TARGET_HANDLE } from "@/features/canvas/utils/pageFilter";

export type ExternalGroupNodeData = {
  label: string;
  tableCount: number;
  linkCount?: number;
};

const stubSurface = {
  borderColor: "color-mix(in srgb, hsl(var(--muted-foreground)) 45%, transparent)",
  backgroundColor: "color-mix(in srgb, hsl(var(--muted-foreground)) 5%, transparent)",
} as CSSProperties;

function ExternalGroupNodeImpl({ data }: { data: ExternalGroupNodeData }) {
  return (
    <div
      className="external-group-node pointer-events-auto box-border w-[240px] min-h-[56px] rounded-lg border border-dashed px-2.5 py-2 text-card-foreground shadow-sm"
      style={stubSurface}
      title="Grupo fora da página atual — marque no painel Páginas para expandir"
    >
      <Handle
        type="target"
        position={Position.Left}
        id={EXTERNAL_TARGET_HANDLE}
        className="external-group-node__handle !h-2 !w-2 !border !border-card !bg-muted-foreground"
      />
      <Handle
        type="source"
        position={Position.Right}
        id={EXTERNAL_SOURCE_HANDLE}
        className="external-group-node__handle !h-2 !w-2 !border !border-card !bg-muted-foreground"
      />
      <div className="external-group-node__header flex items-center gap-1.5 text-sm font-semibold leading-snug">
        <ChevronRight
          className="external-group-node__toggle shrink-0 text-muted-foreground"
          size={14}
          strokeWidth={1.5}
        />
        <span className="external-group-node__label overflow-hidden text-ellipsis whitespace-nowrap">
          {data.label}
        </span>
      </div>
      <div className="external-group-node__meta mt-1 text-xs text-muted-foreground">
        {data.linkCount ? `${data.linkCount} ligação(ões) · ` : ""}
        {data.tableCount} tabela(s) fora da página
      </div>
    </div>
  );
}

export const ExternalGroupNode = memo(ExternalGroupNodeImpl);
