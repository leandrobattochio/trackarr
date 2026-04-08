import { useState, type FormEvent } from "react";
import { Plus, Check, ChevronLeft, Loader2, Search, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePlugins, useCreateIntegration } from "@/features/integrations/hooks";
import type { ApiPlugin, ApiPluginField } from "@/features/integrations/types";
import {
  BASE_URL_FIELD_NAME,
  getAllFields,
  getInitialFieldValues,
  normalizeFieldValue,
  normalizeIntegrationFieldValues,
  validateBaseUrlValue,
  validateFieldValue,
  validateIntegrationFields,
} from "@/features/integrations/components/add-integration-validation";
import { useDebounce } from "@/shared/hooks/use-debounce";
import { toast } from "sonner";

interface AddIntegrationDialogProps {
  addedPluginIds: string[];
}

function getFieldHelpText(field: ApiPluginField): string | null {
  return field.description?.trim() || null;
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

export function AddIntegrationDialog({ addedPluginIds }: AddIntegrationDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<ApiPlugin | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebounce(search, 250);

  const { data: plugins = [], isLoading: pluginsLoading } = usePlugins();
  const { mutate: createIntegration, isPending: isCreating } = useCreateIntegration();

  const filteredPlugins = debouncedSearch.trim()
    ? plugins.filter((p) =>
        p.displayName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.pluginId.toLowerCase().includes(debouncedSearch.toLowerCase()),
      )
    : plugins;

  function handleSelectPlugin(plugin: ApiPlugin) {
    setSelectedPlugin(plugin);
    setFieldValues(getInitialFieldValues(plugin));
    setFieldErrors({});
    setSubmitError(null);
  }

  function handleBack() {
    setSelectedPlugin(null);
    setFieldValues({});
    setFieldErrors({});
    setSubmitError(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    /* c8 ignore next */
    if (!selectedPlugin) return;

    const normalizedFieldValues = normalizeIntegrationFieldValues(selectedPlugin, fieldValues);
    const nextFieldErrors = validateIntegrationFields(selectedPlugin, normalizedFieldValues);
    setFieldValues(normalizedFieldValues);
    setFieldErrors(nextFieldErrors);
    setSubmitError(null);

    if (Object.keys(nextFieldErrors).length > 0)
      return;

    createIntegration(
      { pluginId: selectedPlugin.pluginId, payload: JSON.stringify(normalizedFieldValues) },
      {
        onSuccess: () => {
          toast.success(`${selectedPlugin.displayName} integration added`);
          setOpen(false);
          setSelectedPlugin(null);
          setFieldValues({});
          setFieldErrors({});
          setSubmitError(null);
        },
        onError: (err) => {
          setSubmitError(err.message);
          toast.error(err.message);
        },
      },
    );
  }

  function handleOpenChange(value: boolean) {
    setOpen(value);
    if (!value) {
      setSelectedPlugin(null);
      setFieldValues({});
      setFieldErrors({});
      setSubmitError(null);
      setSearch("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Tracker
        </Button>
      </DialogTrigger>

      <DialogContent>
        {selectedPlugin === null ? (
          <>
            <DialogHeader>
              <DialogTitle>Add Tracker Integration</DialogTitle>
              <DialogDescription>Choose a private tracker to connect.</DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search trackers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="overflow-y-auto h-[268px] space-y-3 pr-1">
              {pluginsLoading && (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!pluginsLoading && filteredPlugins.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No trackers match "{debouncedSearch}"
                </p>
              )}

              {!pluginsLoading && filteredPlugins.map((plugin) => {
                const isAdded = addedPluginIds.includes(plugin.pluginId);
                return (
                  <button
                    key={plugin.pluginId}
                    disabled={isAdded}
                    onClick={() => handleSelectPlugin(plugin)}
                    className="flex w-full items-center gap-4 rounded-lg border border-border/50 bg-muted/30 p-4 text-left transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10 font-display text-sm font-bold text-primary">
                      {plugin.displayName.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-display text-sm font-semibold">{plugin.displayName}</p>
                      <p className="text-xs text-muted-foreground">{plugin.pluginId}</p>
                    </div>
                    {isAdded && <Check className="h-5 w-5 text-success" />}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleBack} className="h-7 w-7">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DialogTitle>{selectedPlugin.displayName}</DialogTitle>
              </div>
              <DialogDescription>Enter your credentials to connect this tracker.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
              {submitError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
                  {submitError}
                </div>
              )}
              <BaseUrlField
                plugin={selectedPlugin}
                value={fieldValues[BASE_URL_FIELD_NAME] ?? ""}
                error={fieldErrors[BASE_URL_FIELD_NAME]}
                onChange={(value) => {
                  setSubmitError(null);
                  setFieldValues((prev) => ({ ...prev, [BASE_URL_FIELD_NAME]: value }));
                  setFieldErrors((prev) => {
                    const nextError = validateBaseUrlValue(selectedPlugin, value);
                    if (!nextError) {
                      const { [BASE_URL_FIELD_NAME]: _removed, ...rest } = prev;
                      return rest;
                    }

                    return { ...prev, [BASE_URL_FIELD_NAME]: nextError };
                  });
                }}
              />
              <FieldSection
                title="Connection"
                fields={selectedPlugin.fields}
                fieldValues={fieldValues}
                fieldErrors={fieldErrors}
                onChange={(field, value) => {
                  setSubmitError(null);
                  setFieldValues((prev) => ({ ...prev, [field.name]: value }));
                  setFieldErrors((prev) => {
                    const nextError = validateFieldValue(field, normalizeFieldValue(field, value));
                    if (!nextError) {
                      const { [field.name]: _removed, ...rest } = prev;
                      return rest;
                    }

                    return { ...prev, [field.name]: nextError };
                  });
                }}
              />
              <FieldSection
                title="Custom Fields"
                fields={selectedPlugin.customFields}
                fieldValues={fieldValues}
                fieldErrors={fieldErrors}
                onChange={(field, value) => {
                  setSubmitError(null);
                  setFieldValues((prev) => ({ ...prev, [field.name]: value }));
                  setFieldErrors((prev) => {
                    const nextError = validateFieldValue(field, normalizeFieldValue(field, value));
                    if (!nextError) {
                      const { [field.name]: _removed, ...rest } = prev;
                      return rest;
                    }

                    return { ...prev, [field.name]: nextError };
                  });
                }}
              />

              <Button type="submit" className="w-full" disabled={isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isCreating ? "Connecting…" : "Connect"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FieldSectionProps {
  title: string;
  fields: ApiPluginField[];
  fieldValues: Record<string, string>;
  fieldErrors: Record<string, string>;
  onChange: (field: ApiPluginField, value: string) => void;
}

interface BaseUrlFieldProps {
  plugin: ApiPlugin;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

function BaseUrlField({ plugin, value, error, onChange }: BaseUrlFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={BASE_URL_FIELD_NAME}>
        Base URL
        <span className="ml-1 text-destructive">*</span>
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={BASE_URL_FIELD_NAME}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${BASE_URL_FIELD_NAME}-error` : undefined}
          className={error ? "border-destructive focus-visible:ring-destructive" : undefined}
        >
          <SelectValue placeholder="Select a base URL" />
        </SelectTrigger>
        <SelectContent>
          {plugin.baseUrls.map((baseUrl) => (
            <SelectItem key={baseUrl} value={baseUrl}>
              {baseUrl}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p id={`${BASE_URL_FIELD_NAME}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function FieldSection({ title, fields, fieldValues, fieldErrors, onChange }: FieldSectionProps) {
  if (fields.length === 0) return null;

  return (
    <div className="space-y-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      {fields.map((field) => (
        <div key={field.name} className="space-y-1.5">
          <Label htmlFor={field.name}>
            {field.label}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </Label>
          <Input
            id={field.name}
            type={getInputType(field.type, field.sensitive)}
            /* c8 ignore next */
            value={fieldValues[field.name] ?? ""}
            placeholder={getFieldPlaceholder(field.type)}
            autoComplete="off"
            step={field.type === "number" ? "any" : undefined}
            aria-invalid={fieldErrors[field.name] ? "true" : "false"}
            aria-describedby={fieldErrors[field.name] ? `${field.name}-error` : undefined}
            onChange={(e) => onChange(field, e.target.value)}
            className={fieldErrors[field.name] ? "border-destructive focus-visible:ring-destructive" : undefined}
          />
          {fieldErrors[field.name] && (
            <p id={`${field.name}-error`} className="text-xs text-destructive">
              {fieldErrors[field.name]}
            </p>
          )}
          {getFieldHelpText(field) && (
            <FieldDescription description={getFieldHelpText(field)!} />
          )}
        </div>
      ))}
    </div>
  );
}

function FieldDescription({ description }: { description: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/70" />
        <p className="leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
