export type DbtDrawerTab = "dbt" | "ddl" | "records" | "diff";
export type DbmlDrawerTab = "dbml" | "records" | "diff";
export type DrawerTab = DbtDrawerTab | DbmlDrawerTab;

export const DRAWER_TAB_STORAGE_KEY = "strata.codeDrawerTab";

export function defaultDrawerTab(format: "dbml" | "dbt"): DrawerTab {
  return format === "dbt" ? "dbt" : "dbml";
}

export function isTabForFormat(tab: string, format: "dbml" | "dbt"): tab is DrawerTab {
  if (format === "dbt")
    return tab === "dbt" || tab === "ddl" || tab === "records" || tab === "diff";
  return tab === "dbml" || tab === "records" || tab === "diff";
}

export function readStoredDrawerTab(format: "dbml" | "dbt"): DrawerTab {
  try {
    const raw = localStorage.getItem(DRAWER_TAB_STORAGE_KEY);
    if (raw && isTabForFormat(raw, format)) return raw;
  } catch {
    /* private mode / blocked storage */
  }
  return defaultDrawerTab(format);
}

export function writeStoredDrawerTab(tab: DrawerTab): void {
  try {
    localStorage.setItem(DRAWER_TAB_STORAGE_KEY, tab);
  } catch {
    /* ignore */
  }
}
