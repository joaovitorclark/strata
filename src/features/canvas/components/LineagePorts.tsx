import { Handle } from "@xyflow/react";
import { LINEAGE_PORTS } from "@/features/canvas/utils/lineageHandles";

/** Pontos de conexão no meio das 4 bordas do cartão (L1). */
export function LineagePorts() {
  return (
    <>
      {LINEAGE_PORTS.flatMap((port) => [
        <Handle
          key={`${port.id}-s`}
          type="source"
          position={port.position}
          id={`${port.id}-s`}
          style={port.style}
          className="lineage-port-handle nodrag nopan !z-10 !h-[11px] !min-h-[11px] !w-[11px] !min-w-[11px] !border-2 !border-rel-lineage !bg-card opacity-50 transition-[opacity,transform] duration-100 hover:scale-125 hover:cursor-crosshair hover:opacity-100 hover:!bg-[hsl(var(--rel-lineage)_/_0.2)]"
          isConnectable
        />,
        <Handle
          key={`${port.id}-t`}
          type="target"
          position={port.position}
          id={`${port.id}-t`}
          style={port.style}
          className="lineage-port-handle nodrag nopan !z-10 !h-[11px] !min-h-[11px] !w-[11px] !min-w-[11px] !border-2 !border-rel-lineage !bg-card opacity-50 transition-[opacity,transform] duration-100 hover:scale-125 hover:cursor-crosshair hover:opacity-100 hover:!bg-[hsl(var(--rel-lineage)_/_0.2)]"
          isConnectable
        />,
      ])}
    </>
  );
}
