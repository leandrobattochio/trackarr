import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MetricTooltip } from "@/features/integrations/components/shared/MetricTooltip";
import { usePlugins, useUpdateIntegration } from "@/features/integrations/hooks";
import type { ApiPlugin, TrackerIntegration } from "@/features/integrations/types";
import { getAllFields, getInitialFieldValues } from "@/features/integrations/components/add-integration-validation";
import { IntegrationConfigurationForm } from "@/features/integrations/components/shared/integration-dialog/IntegrationConfigurationForm";
import { createEditIntegrationFormStrategy } from "@/features/integrations/components/shared/integration-dialog/integrationFormStrategies";
import { toast } from "sonner";

interface EditIntegrationDialogProps {
  tracker: TrackerIntegration;
  disabled?: boolean;
}

function buildInitialFieldValues(plugin: ApiPlugin | undefined, payload: Record<string, string>) {
  if (!plugin) return payload;

  return getInitialFieldValues(
    plugin,
    Object.fromEntries(
      getAllFields(plugin).map((field) => [
        field.name,
        field.sensitive ? "" : (payload[field.name] ?? ""),
      ]),
    ),
  );
}

export function EditIntegrationDialog({ tracker, disabled = false }: EditIntegrationDialogProps) {
  const [open, setOpen] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const { data: plugins = [] } = usePlugins();
  const { mutate: updateIntegration, isPending: isUpdating } = useUpdateIntegration();

  const plugin = plugins.find((item) => item.pluginId === tracker.pluginId);
  const formStrategy = createEditIntegrationFormStrategy({
    trackerId: tracker.id,
    fieldValues,
    setFieldValues,
  });

  useEffect(() => {
    if (open) {
      setFieldValues(buildInitialFieldValues(plugin, tracker.payload));
    }
  }, [open, tracker.payload, plugin]);

  function handleOpenChange(value: boolean) {
    setOpen(value);
    if (!value) {
      setFieldValues(buildInitialFieldValues(plugin, tracker.payload));
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    /* c8 ignore next */
    if (!plugin) return;

    updateIntegration(
      {
        id: tracker.id,
        dto: {
          pluginId: tracker.pluginId,
          payload: JSON.stringify(fieldValues),
        },
      },
      {
        onSuccess: () => {
          toast.success(`${tracker.name} updated`);
          setOpen(false);
        },
        onError: (err) => toast.error(`Update failed: ${err.message}`),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <MetricTooltip
        label="Edit Integration"
        eyebrow="Configuration"
        description="Update the saved tracker connection values and sync settings."
      >
        <DialogTrigger asChild>
          <span className="inline-flex">
            <Button size="sm" variant="ghost" disabled={disabled} aria-label="Edit integration">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </span>
        </DialogTrigger>
      </MetricTooltip>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {tracker.name}</DialogTitle>
          <DialogDescription>Update the saved connection values for this tracker.</DialogDescription>
        </DialogHeader>

        {plugin ? (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <IntegrationConfigurationForm plugin={plugin} strategy={formStrategy} />

            <Button type="submit" className="w-full" disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isUpdating ? "Saving..." : "Save changes"}
            </Button>
          </form>
        ) : (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            Plugin configuration unavailable.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
