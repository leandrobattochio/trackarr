import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { TrackerIntegration } from "@/features/integrations/types";
import { toast } from "sonner";

interface EditIntegrationDialogProps {
  tracker: TrackerIntegration;
  disabled?: boolean;
}

const SENSITIVE_MASK = "*****";

function getFieldHelpText(type: string): string | null {
  if (type !== "cron") return null;

  return "Use a Hangfire cron expression in UTC, for example `0 * * * *` to run every hour.";
}

function getFieldPlaceholder(type: string): string | undefined {
  if (type === "cron") return "0 * * * *";
  if (type === "number") return "1.00";
  return undefined;
}

function getInputType(type: string, sensitive: boolean): string {
  if (sensitive || type === "password") return "password";
  if (type === "number") return "number";
  return "text";
}

export function EditIntegrationDialog({ tracker, disabled = false }: EditIntegrationDialogProps) {
  const [open, setOpen] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const { data: plugins = [] } = usePlugins();
  const { mutate: updateIntegration, isPending: isUpdating } = useUpdateIntegration();

  const plugin = plugins.find((item) => item.pluginId === tracker.pluginId);

  function buildInitialFieldValues() {
    if (!plugin) return tracker.payload;

    return Object.fromEntries(
      plugin.fields.map((field) => [
        field.name,
        field.sensitive ? "" : (tracker.payload[field.name] ?? ""),
      ]),
    );
  }

  useEffect(() => {
    if (open) {
      setFieldValues(buildInitialFieldValues());
    }
  }, [open, tracker.payload, plugin]);

  function handleOpenChange(value: boolean) {
    setOpen(value);
    if (!value) {
      setFieldValues(buildInitialFieldValues());
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
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
            {plugin.fields.map((field) => (
              <div key={field.name} className="space-y-1.5">
                <Label htmlFor={`${tracker.id}-${field.name}`}>
                  {field.label}
                  {field.required && <span className="ml-1 text-destructive">*</span>}
                </Label>
                <Input
                  id={`${tracker.id}-${field.name}`}
                  type={getInputType(field.type, field.sensitive)}
                  required={field.required}
                  value={fieldValues[field.name] ?? ""}
                  placeholder={field.sensitive ? SENSITIVE_MASK : getFieldPlaceholder(field.type)}
                  autoComplete="off"
                  step={field.type === "number" ? "any" : undefined}
                  onChange={(e) =>
                    setFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                  }
                />
                {getFieldHelpText(field.type) && (
                  <p className="text-xs text-muted-foreground">{getFieldHelpText(field.type)}</p>
                )}
              </div>
            ))}

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
