import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ApiPlugin, ApiPluginField } from "@/features/integrations/types";
import type { IntegrationFormStrategy } from "@/features/integrations/components/shared/integration-dialog/integrationFormStrategies";

interface IntegrationConfigurationFormProps {
  plugin: ApiPlugin;
  strategy: IntegrationFormStrategy;
}

export function IntegrationConfigurationForm({ plugin, strategy }: IntegrationConfigurationFormProps) {
  return (
    <>
      <BaseUrlField plugin={plugin} strategy={strategy} />
      <FieldSection title="Connection" fields={plugin.fields} strategy={strategy} />
      <FieldSection title="Custom Fields" fields={plugin.customFields} strategy={strategy} />
    </>
  );
}

function BaseUrlField({ plugin, strategy }: IntegrationConfigurationFormProps) {
  const { id, value, error, onChange } = strategy.getBaseUrlProps();

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        Base URL
        <span className="ml-1 text-destructive">*</span>
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-error` : undefined}
          className={error ? "border-destructive focus:border-destructive focus:ring-destructive" : undefined}
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
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

interface FieldSectionProps {
  title: string;
  fields: ApiPluginField[];
  strategy: IntegrationFormStrategy;
}

function FieldSection({ title, fields, strategy }: FieldSectionProps) {
  if (fields.length === 0) return null;

  return (
    <div className="space-y-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      {fields.map((field) => {
        const { id, value, error, placeholder, required, onChange } = strategy.getFieldProps(field);
        const description = getFieldHelpText(field);

        return (
          <div key={field.name} className="space-y-1.5">
            <Label htmlFor={id}>
              {field.label}
              {field.required && <span className="ml-1 text-destructive">*</span>}
            </Label>
            <Input
              id={id}
              type={getInputType(field.type, field.sensitive)}
              required={required}
              /* c8 ignore next */
              value={value}
              placeholder={placeholder}
              autoComplete="off"
              step={field.type === "number" ? "any" : undefined}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(event) => onChange(event.target.value)}
              className={error ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive" : undefined}
            />
            {error && (
              <p id={`${id}-error`} className="text-xs text-destructive">
                {error}
              </p>
            )}
            {description && <FieldDescription description={description} />}
          </div>
        );
      })}
    </div>
  );
}

function getFieldHelpText(field: ApiPluginField): string | null {
  return field.description?.trim() || null;
}

function getInputType(type: string, sensitive: boolean): string {
  if (sensitive || type === "password") return "password";
  if (type === "number") return "number";
  return "text";
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
