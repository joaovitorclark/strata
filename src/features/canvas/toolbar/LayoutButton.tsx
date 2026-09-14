import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export type LayoutButtonProps = {
  onAutolayout: () => void;
};

export function LayoutButton({ onAutolayout }: LayoutButtonProps) {
  const { t } = useTranslation();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      data-testid="layout-button"
      aria-label={t("canvas.toolbar.layout")}
      className={cn(FOCUS, "h-7 rounded-full px-2 text-2xs")}
      onClick={onAutolayout}
    >
      {t("canvas.toolbar.layout")}
    </Button>
  );
}
