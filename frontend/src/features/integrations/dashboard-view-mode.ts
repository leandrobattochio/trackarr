import { usePersistedState } from "@/shared/hooks/use-persisted-state";

export const DASHBOARD_VIEW_MODE_STORAGE_KEY = "trackarr.dashboard.view-mode";

export const DASHBOARD_VIEW_MODES = ["cards", "list"] as const;

export type DashboardViewMode = (typeof DASHBOARD_VIEW_MODES)[number];

export function isDashboardViewMode(value: unknown): value is DashboardViewMode {
  return DASHBOARD_VIEW_MODES.includes(value as DashboardViewMode);
}

function parseDashboardViewMode(value: unknown) {
  return isDashboardViewMode(value) ? value : undefined;
}

export function useDashboardViewMode() {
  return usePersistedState<DashboardViewMode>(DASHBOARD_VIEW_MODE_STORAGE_KEY, "cards", parseDashboardViewMode);
}
