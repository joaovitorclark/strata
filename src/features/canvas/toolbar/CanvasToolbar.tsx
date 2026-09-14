import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { DetailLevelSelect } from "./DetailLevelSelect";
import { EdgeVisibility } from "./EdgeVisibility";
import { FocusControls } from "./FocusControls";
import { LayoutButton } from "./LayoutButton";
import { MiniMapToggle } from "./MiniMapToggle";
import { ViewTabs } from "./ViewTabs";
import { ZoomControls } from "./ZoomControls";

export type CanvasToolbarProps = {
  onAutolayout?: () => void;
};

export function CanvasToolbar({ onAutolayout }: CanvasToolbarProps) {
  return (
    <div
      data-testid="canvas-toolbar"
      className={cn(
        "nodrag nopan nowheel pointer-events-auto absolute bottom-3 left-1/2 z-10 flex h-9",
        "-translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/95 px-1.5 shadow-md",
      )}
    >
      <ViewTabs />
      <ZoomControls />
      {onAutolayout ? (
        <>
          <Separator orientation="vertical" className="h-5" />
          <LayoutButton onAutolayout={onAutolayout} />
        </>
      ) : null}
      <Separator orientation="vertical" className="h-5" />
      <EdgeVisibility />
      <DetailLevelSelect />
      <FocusControls />
      <MiniMapToggle />
    </div>
  );
}
