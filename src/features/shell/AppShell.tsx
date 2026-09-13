import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeName = "dark" | "light";

export const THEME_STORAGE_KEY = "theme";

export function resolveTheme(stored: string | null): ThemeName {
  return stored === "light" ? "light" : "dark";
}

export function applyThemeClass(theme: ThemeName): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function shellColumns(treeCollapsed: boolean, inspectorCollapsed: boolean): string {
  const tree = treeCollapsed ? "0px" : "176px";
  const inspector = inspectorCollapsed ? "0px" : "auto";
  return `46px ${tree} 1fr ${inspector}`;
}

type ShellLayout = {
  treeCollapsed: boolean;
  inspectorCollapsed: boolean;
  setTreeCollapsed: (collapsed: boolean) => void;
  setInspectorCollapsed: (collapsed: boolean) => void;
};

const ShellLayoutContext = createContext<ShellLayout | null>(null);

export function useShellLayout(): ShellLayout {
  const ctx = useContext(ShellLayoutContext);
  if (!ctx) throw new Error("useShellLayout must be used within AppShell");
  return ctx;
}

function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function ThemeController() {
  useLayoutEffect(() => {
    applyThemeClass(resolveTheme(readStoredTheme()));
  }, []);
  return null;
}

function Slot({
  name,
  as: Tag = "div",
  className,
  children,
}: {
  name: string;
  as?: "div" | "header" | "aside" | "main" | "footer";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Tag data-slot={name} className={className}>
      {children}
    </Tag>
  );
}

export type AppShellSlots = {
  navbar?: ReactNode;
  rail?: ReactNode;
  tree?: ReactNode;
  canvas?: ReactNode;
  inspector?: ReactNode;
  drawer?: ReactNode;
  statusbar?: ReactNode;
};

export function AppShell({
  navbar,
  rail,
  tree,
  canvas,
  inspector,
  drawer,
  statusbar,
}: AppShellSlots = {}) {
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const layout = useMemo(
    () => ({
      treeCollapsed,
      inspectorCollapsed,
      setTreeCollapsed,
      setInspectorCollapsed,
    }),
    [treeCollapsed, inspectorCollapsed],
  );

  return (
    <>
      <ThemeController />
      <ShellLayoutContext.Provider value={layout}>
        <div
          data-shell="root"
          className="grid h-svh w-full bg-background text-foreground"
          style={{ gridTemplateRows: "auto 1fr auto" }}
        >
          <Slot name="navbar" as="header">
            {navbar}
          </Slot>
          <div
            data-shell="middle"
            className="relative grid min-h-0"
            style={{ gridTemplateColumns: shellColumns(treeCollapsed, inspectorCollapsed) }}
          >
            <Slot name="rail" as="aside" className="relative z-20 min-h-0 overflow-hidden">
              {rail}
            </Slot>
            <Slot name="tree" as="aside" className="relative z-20 min-h-0 min-w-0 overflow-hidden">
              {tree}
            </Slot>
            <Slot name="canvas" as="main" className="strata-canvas relative z-0 min-h-0 min-w-0">
              {canvas}
            </Slot>
            <Slot
              name="inspector"
              as="aside"
              className="relative z-20 min-h-0 min-w-0 overflow-hidden"
            >
              {inspector}
            </Slot>
            <Slot name="drawer" className="absolute inset-x-0 bottom-0 z-10">
              {drawer}
            </Slot>
          </div>
          <Slot name="statusbar" as="footer">
            {statusbar}
          </Slot>
        </div>
      </ShellLayoutContext.Provider>
    </>
  );
}
