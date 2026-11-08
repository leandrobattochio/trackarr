import { LayoutGrid, List } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DASHBOARD_VIEW_MODES,
  isDashboardViewMode,
  type DashboardViewMode,
} from "@/features/integrations/dashboard-view-mode";

const VIEW_OPTIONS: Record<DashboardViewMode, { label: string; icon: LucideIcon }> = {
  cards: { label: "Cards view", icon: LayoutGrid },
  list: { label: "List view", icon: List },
};

interface DashboardViewToggleProps {
  value: DashboardViewMode;
  onChange: (mode: DashboardViewMode) => void;
}

export function DashboardViewToggle({ value, onChange }: DashboardViewToggleProps) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={value}
      onValueChange={(next) => {
        // Radix sends "" when the pressed item is clicked again; the view stays as it is.
        if (isDashboardViewMode(next))
          onChange(next);
      }}
      aria-label="Dashboard view"
      className="flex-nowrap gap-1"
    >
      {DASHBOARD_VIEW_MODES.map((mode) => {
        const { label, icon: Icon } = VIEW_OPTIONS[mode];
        return (
          <ToggleGroupItem key={mode} value={mode} aria-label={label} title={label} data-testid={`dashboard-view-${mode}`}>
            <Icon className="h-4 w-4" />
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
