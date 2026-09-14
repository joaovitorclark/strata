import { Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotation } from "@/features/canvas/hooks/useNotation";
import { useSchemaStore } from "@/features/schema/store";
import { cn } from "@/lib/utils";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function EdgeVisibility() {
  const { t } = useTranslation();
  const relationsVisible = useSchemaStore((s) => s.relationsVisible);
  const toggleRelationsVisible = useSchemaStore((s) => s.toggleRelationsVisible);
  const lineageVisible = useSchemaStore((s) => s.lineageVisible);
  const toggleLineageVisible = useSchemaStore((s) => s.toggleLineageVisible);
  const [notation, setNotation] = useNotation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="edge-visibility"
          aria-label={t("canvas.toolbar.edges")}
          className={cn(
            FOCUS,
            "inline-flex size-7 items-center justify-center rounded-full text-foreground hover:bg-accent",
          )}
        >
          <Eye size={14} strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top">
        <DropdownMenuCheckboxItem
          checked={relationsVisible}
          onCheckedChange={() => toggleRelationsVisible()}
        >
          {t("canvas.toolbar.relations")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={lineageVisible}
          onCheckedChange={() => toggleLineageVisible()}
        >
          {t("canvas.toolbar.lineage")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-testid="notation-menu">
            {t("canvas.toolbar.notation")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={notation}
              onValueChange={(value) => {
                if (value === "ie" || value === "barker" || value === "minimal") {
                  setNotation(value);
                }
              }}
            >
              <DropdownMenuRadioItem data-testid="notation-ie" value="ie">
                {t("canvas.toolbar.notationIe")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem data-testid="notation-barker" value="barker">
                {t("canvas.toolbar.notationBarker")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem data-testid="notation-minimal" value="minimal">
                {t("canvas.toolbar.notationMinimal")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
