import type { ReactElement, ReactNode } from "react";
import { cloneElement, isValidElement } from "react";
import { useTranslation } from "react-i18next";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useShellLayout } from "@/features/shell/AppShell";
import type { SchemaTreeProps } from "@/features/shell/SchemaTree";
import { cn } from "@/lib/utils";

export type LeftPanelTab = "tables" | "layers";

export type LeftPanelProps = {
  tab: LeftPanelTab;
  onTab: (tab: LeftPanelTab) => void;
  tables: ReactNode;
  layers: ReactNode;
  onFocusTable?: (id: string) => void;
};

export function LeftPanel({ tab, onTab, tables, layers, onFocusTable }: LeftPanelProps) {
  const { t } = useTranslation();
  const { setTreeCollapsed, setInspectorCollapsed } = useShellLayout();

  const mountedTables = isValidElement(tables)
    ? cloneElement(tables as ReactElement<SchemaTreeProps>, {
        onFocusTable: (tables.props as SchemaTreeProps).onFocusTable ?? onFocusTable,
        onOpenInspector:
          (tables.props as SchemaTreeProps).onOpenInspector ?? (() => setInspectorCollapsed(false)),
      })
    : tables;

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const next = value === "layers" ? "layers" : "tables";
        setTreeCollapsed(false);
        onTab(next);
      }}
      data-testid="left-panel"
      className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground"
    >
      <TabsList className="grid h-8 w-full shrink-0 grid-cols-2 rounded-none bg-transparent p-0">
        <TabsTrigger value="tables" className="rounded-none text-xs">
          {t("shell.rail.tables")}
        </TabsTrigger>
        <TabsTrigger
          value="layers"
          data-testid="left-panel-layers"
          className="rounded-none text-xs"
        >
          {t("shell.rail.layers")}
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="tables"
        forceMount
        className={cn("mt-0 min-h-0 flex-1 overflow-hidden", tab !== "tables" && "hidden")}
      >
        {mountedTables}
      </TabsContent>
      <TabsContent
        value="layers"
        forceMount
        className={cn("mt-0 min-h-0 flex-1 overflow-auto", tab !== "layers" && "hidden")}
      >
        {layers}
      </TabsContent>
    </Tabs>
  );
}
