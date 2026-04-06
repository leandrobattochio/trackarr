import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { snapshotRangeOptions, type SnapshotRangeKey } from "@/features/snapshots/range";

interface SnapshotIntegrationOption {
  id: string;
  name: string;
  username?: string | null;
}

interface SnapshotFiltersCardProps {
  integrationId: string;
  range: SnapshotRangeKey;
  from: string;
  to: string;
  integrations: SnapshotIntegrationOption[];
  integrationsLoading: boolean;
  pluginsLoading: boolean;
  isBusy: boolean;
  activeFilterAction: "apply" | "reset" | null;
  onIntegrationChange: (value: string) => void;
  onRangeChange: (value: SnapshotRangeKey) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
}

export function SnapshotFiltersCard({
  integrationId,
  range,
  from,
  to,
  integrations,
  integrationsLoading,
  pluginsLoading,
  isBusy,
  activeFilterAction,
  onIntegrationChange,
  onRangeChange,
  onFromChange,
  onToChange,
  onApply,
  onReset,
}: SnapshotFiltersCardProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_auto_auto]">
        <div className="space-y-1.5">
          <Label>Integration</Label>
          <Select value={integrationId} onValueChange={onIntegrationChange} disabled={integrationsLoading || pluginsLoading}>
            <SelectTrigger>
              <SelectValue placeholder="Select an integration" />
            </SelectTrigger>
            <SelectContent>
              {integrations.map((integration) => (
                <SelectItem key={integration.id} value={integration.id}>
                  {integration.name}{integration.username ? ` - ${integration.username}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label>Range</Label>
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(value) => value && onRangeChange(value as SnapshotRangeKey)}
            aria-label="Snapshot range"
          >
            {snapshotRangeOptions.map((option) => (
              <ToggleGroupItem
                key={option.key}
                value={option.key}
                aria-label={`Range ${option.label}`}
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {range === "custom" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="snapshot-from">From</Label>
                <Input
                  id="snapshot-from"
                  type="datetime-local"
                  value={from}
                  onChange={(event) => onFromChange(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="snapshot-to">To</Label>
                <Input
                  id="snapshot-to"
                  type="datetime-local"
                  value={to}
                  onChange={(event) => onToChange(event.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {range === "custom" && (
          <div className="flex items-end">
            <Button
              className="w-full xl:w-auto"
              onClick={onApply}
              disabled={!integrationId || !from || !to || isBusy}
            >
              {activeFilterAction === "apply" && isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply
            </Button>
          </div>
        )}

        <div className="flex items-end">
          <Button
            variant="outline"
            className="w-full xl:w-auto"
            onClick={onReset}
            disabled={isBusy}
          >
            {activeFilterAction === "reset" && isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
