import { configureMonacoYaml } from "monaco-yaml";
import type * as Monaco from "monaco-editor";
import { isMap, isScalar, isSeq, LineCounter, parseDocument, Scalar, YAMLMap } from "yaml";

export const PLUGIN_EDITOR_MODEL_URI = "file:///trackarr-plugin-definition.yaml";

const FIELD_TYPES = ["text", "number", "password", "cron"] as const;
const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
const RESPONSE_TYPES = ["json", "html"] as const;
const TRANSFORMS = ["byteSize", "decimal", "integer", "toString"] as const;
const VALIDATION_RULES = ["notEmpty"] as const;
const VALIDATION_FAILURES = ["authFailed", "unknownError"] as const;
const DASHBOARD_STATS = [
  "ratio",
  "uploadedBytes",
  "downloadedBytes",
  "seedBonus",
  "buffer",
  "hitAndRuns",
  "requiredRatio",
  "seedingTorrents",
  "leechingTorrents",
  "activeTorrents",
] as const;
const DASHBOARD_FORMATS = ["bytes", "count", "text"] as const;
const DASHBOARD_ICONS = ["arrow-up", "arrow-down", "coins", "hard-drive", "shield-alert"] as const;
const DASHBOARD_TONES = ["success", "primary", "warning", "destructive", "muted"] as const;

const ROOT_COMPLETION_DOCS: Record<string, string> = {
  pluginId: "Unique identifier for the plugin. This must match the route parameter when editing an existing definition.",
  displayName: "User-facing name shown in the frontend when the plugin appears in the tracker catalog and dashboard.",
  fields: "List of user-configurable values rendered in the Add Tracker and Edit Integration dialogs.",
  http: "Shared HTTP client configuration. Use it for base URL, headers, or cookies that apply to every step.",
  authFailure: "Rules that classify a response as an authentication failure instead of a generic sync error.",
  steps: "Ordered requests executed by the YAML plugin engine. Step outputs can be referenced later in mapping or URL templates.",
  mapping: "Binds extracted values and configured fields into the final normalized tracker stats object.",
  dashboard: "Controls which metrics appear on the rendered tracker card in the frontend.",
};

const VALUE_DOCS: Record<string, string> = {
  text: "Render plain text or display the metric as plain text.",
  number: "Numeric integration field rendered as a number input.",
  password: "Sensitive integration field rendered as a password input.",
  cron: "Hangfire cron expression in UTC, for example `0 * * * *` for an hourly sync.",
  GET: "Issue a GET request for this step.",
  POST: "Issue a POST request for this step.",
  PUT: "Issue a PUT request for this step.",
  DELETE: "Issue a DELETE request for this step.",
  json: "Parse the response body as JSON. JSON `path` extraction is valid for this response type.",
  html: "Treat the response body as raw HTML/text. Use regex extraction instead of JSON paths.",
  byteSize: "Convert values like `1.5 GiB` into an integer byte count.",
  decimal: "Parse a decimal numeric value such as a ratio.",
  integer: "Parse an integer value such as seeding, leeching, or hit-and-run counts.",
  toString: "Keep the extracted value as trimmed text.",
  notEmpty: "Fail validation when the extracted field is empty or missing.",
  authFailed: "Mark the sync result as an authentication failure.",
  unknownError: "Mark the sync result as a generic unknown error.",
  ratio: "Current tracker ratio.",
  uploadedBytes: "Uploaded byte total.",
  downloadedBytes: "Downloaded byte total.",
  seedBonus: "Seed bonus or points value.",
  buffer: "Tracker-specific buffer value.",
  hitAndRuns: "Hit-and-run count.",
  requiredRatio: "Required ratio threshold, often sourced from a configured field.",
  seedingTorrents: "Current seeding torrent count.",
  leechingTorrents: "Current leeching torrent count.",
  activeTorrents: "Current active torrent count.",
  bytes: "Render the metric as formatted bytes.",
  count: "Render the metric as a localized integer count.",
  "arrow-up": "Uploaded-style metric icon.",
  "arrow-down": "Downloaded-style metric icon.",
  coins: "Seed bonus style icon.",
  "hard-drive": "Buffer or storage-style icon.",
  "shield-alert": "Warning / hit-and-run style icon.",
  success: "Use the success color tone.",
  primary: "Use the primary accent tone.",
  warning: "Use the warning color tone.",
  destructive: "Use the destructive color tone.",
  muted: "Use a neutral muted tone.",
};

const pluginSchema = {
  type: "object",
  additionalProperties: false,
  required: ["pluginId", "displayName", "fields", "steps", "dashboard"],
  properties: {
    pluginId: { type: "string", description: ROOT_COMPLETION_DOCS.pluginId, pattern: "^[a-z0-9][a-z0-9-]*$" },
    displayName: { type: "string", description: ROOT_COMPLETION_DOCS.displayName },
    fields: {
      type: "array",
      description: ROOT_COMPLETION_DOCS.fields,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "label", "type"],
        properties: {
          name: { type: "string", description: "Field key used in templates and integration payloads." },
          label: { type: "string", description: "Label shown in the frontend form." },
          type: { type: "string", enum: [...FIELD_TYPES], description: "Rendered input type." },
          required: { type: "boolean", description: "Whether the field is mandatory in the integration form." },
          sensitive: { type: "boolean", description: "Masks the field in edit mode." },
        },
      },
    },
    http: {
      type: "object",
      description: ROOT_COMPLETION_DOCS.http,
      additionalProperties: false,
      properties: {
        baseUrl: { type: "string", description: "Absolute base URL. Supports field interpolation." },
        headers: { type: "object", additionalProperties: { type: "string" }, description: "Default HTTP headers." },
        cookies: { type: "object", additionalProperties: { type: "string" }, description: "Default cookies." },
      },
    },
    authFailure: {
      type: "object",
      description: ROOT_COMPLETION_DOCS.authFailure,
      additionalProperties: false,
      properties: {
        httpStatusCodes: { type: "array", items: { type: "integer" } },
        htmlPatterns: { type: "array", items: { type: "string" } },
      },
    },
    steps: {
      type: "array",
      description: ROOT_COMPLETION_DOCS.steps,
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "method", "url", "responseType"],
        properties: {
          name: { type: "string", description: "Step identifier used by `steps.<stepName>.<fieldName>` references." },
          method: { type: "string", enum: [...HTTP_METHODS], description: "HTTP method used for this request." },
          url: { type: "string", description: "Relative or absolute request URL. Supports `{{...}}` interpolation." },
          responseType: { type: "string", enum: [...RESPONSE_TYPES], description: "How the response body is interpreted." },
          extract: {
            type: "object",
            additionalProperties: {
              type: "object",
              additionalProperties: false,
              properties: {
                path: { type: "string", description: "JSON path used when `responseType` is `json`." },
                regex: { type: "string", description: "Regex used for HTML or text extraction." },
                transform: { type: "string", enum: [...TRANSFORMS], description: "Post-processing transform." },
                countMatches: { type: "boolean", description: "Count regex matches instead of extracting a single value." },
              },
            },
          },
          validate: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["field", "rule", "onFail"],
              properties: {
                field: { type: "string" },
                rule: { type: "string", enum: [...VALIDATION_RULES] },
                onFail: { type: "string", enum: [...VALIDATION_FAILURES] },
              },
            },
          },
        },
      },
    },
    mapping: {
      type: "object",
      description: ROOT_COMPLETION_DOCS.mapping,
      additionalProperties: false,
      properties: Object.fromEntries(DASHBOARD_STATS.map((stat) => [stat, { type: "string", description: `Mapping expression for ${stat}.` }])),
    },
    dashboard: {
      type: "object",
      description: ROOT_COMPLETION_DOCS.dashboard,
      required: ["metrics"],
      additionalProperties: false,
      properties: {
        metrics: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["stat", "label", "format"],
            properties: {
              stat: { type: "string", enum: [...DASHBOARD_STATS] },
              label: { type: "string" },
              format: { type: "string", enum: [...DASHBOARD_FORMATS] },
              icon: { type: "string", enum: [...DASHBOARD_ICONS] },
              tone: { type: "string", enum: [...DASHBOARD_TONES] },
            },
          },
        },
      },
    },
  },
} as const;

type PluginDefinitionShape = {
  pluginId?: string;
  displayName?: string;
  fields?: Array<{ name?: string; label?: string; type?: string }>;
  steps?: Array<{
    name?: string;
    method?: string;
    url?: string;
    responseType?: string;
    extract?: Record<string, { path?: string; regex?: string; transform?: string; countMatches?: boolean }>;
    validate?: Array<{ field?: string; rule?: string; onFail?: string }>;
  }>;
  mapping?: Record<string, string | undefined>;
  dashboard?: { metrics?: Array<{ stat?: string; label?: string; format?: string; icon?: string; tone?: string }> };
};

export interface PluginYamlValidationOptions {
  expectedPluginId?: string | null;
}

export interface PluginYamlValidationResult {
  markers: Monaco.editor.IMarkerData[];
  parsed: PluginDefinitionShape | null;
}

let isConfigured = false;

export function configurePluginYamlMonaco(monaco: typeof Monaco) {
  if (isConfigured) {
    return;
  }

  configureMonacoYaml(monaco, {
    enableSchemaRequest: false,
    validate: true,
    completion: true,
    hover: true,
    format: true,
    schemas: [
      {
        uri: "trackarr://plugin-definition.schema.json",
        fileMatch: [PLUGIN_EDITOR_MODEL_URI],
        schema: pluginSchema,
      },
    ],
  });

  monaco.languages.registerCompletionItemProvider("yaml", createCompletionProvider(monaco));
  monaco.languages.registerHoverProvider("yaml", createHoverProvider(monaco));
  isConfigured = true;
}

export function installPluginYamlDiagnostics(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  getOptions: () => PluginYamlValidationOptions,
) {
  let timeoutId: number | null = null;

  const runValidation = () => {
    const result = validatePluginYamlDocument(model.getValue(), getOptions());
    monaco.editor.setModelMarkers(model, "trackarr-plugin-semantic", result.markers);
  };

  const queueValidation = () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      runValidation();
    }, 180);
  };

  queueValidation();
  const subscription = model.onDidChangeContent(queueValidation);

  return () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }

    subscription.dispose();
    monaco.editor.setModelMarkers(model, "trackarr-plugin-semantic", []);
  };
}

export function validatePluginYamlDocument(
  source: string,
  options: PluginYamlValidationOptions = {},
): PluginYamlValidationResult {
  const markers: Monaco.editor.IMarkerData[] = [];

  if (!source.trim()) {
    markers.push(createMarkerForFullDocument("Plugin YAML cannot be empty."));
    return { markers, parsed: null };
  }

  const lineCounter = new LineCounter();
  const document = parseDocument(source, { lineCounter, prettyErrors: true });

  for (const error of document.errors) {
    markers.push(createMarker(error.message, document.range ?? [0, source.length], lineCounter));
  }

  if (document.errors.length > 0) {
    return { markers, parsed: null };
  }

  const parsed = (document.toJS() ?? null) as PluginDefinitionShape | null;
  const root = isMap(document.contents) ? document.contents : null;
  if (!root || !parsed) {
    markers.push(createMarkerForFullDocument("YAML could not be deserialized into a plugin definition."));
    return { markers, parsed: null };
  }

  validateTopLevel(root, parsed, lineCounter, markers, options);
  validateFields(root, parsed, lineCounter, markers);
  validateSteps(root, parsed, lineCounter, markers);
  validateMapping(root, parsed, lineCounter, markers);
  validateDashboard(root, parsed, lineCounter, markers);
  validateTemplates(root, parsed, lineCounter, markers);

  return { markers, parsed };
}

function validateTopLevel(
  root: YAMLMap,
  parsed: PluginDefinitionShape,
  lineCounter: LineCounter,
  markers: Monaco.editor.IMarkerData[],
  options: PluginYamlValidationOptions,
) {
  const pluginIdPair = findPair(root, "pluginId");
  const displayNamePair = findPair(root, "displayName");
  const fieldsPair = findPair(root, "fields");
  const stepsPair = findPair(root, "steps");
  const dashboardPair = findPair(root, "dashboard");

  if (!parsed.pluginId?.trim()) {
    markers.push(createMarker("Plugin definition is missing required field 'pluginId'.", pluginIdPair?.value?.range ?? root.range, lineCounter));
  } else if (options.expectedPluginId && parsed.pluginId.trim() !== options.expectedPluginId) {
    markers.push(createMarker("Plugin ID in YAML must match the selected plugin definition.", pluginIdPair?.value?.range ?? root.range, lineCounter));
  }

  if (!parsed.displayName?.trim()) {
    markers.push(createMarker("Plugin definition is missing required field 'displayName'.", displayNamePair?.value?.range ?? root.range, lineCounter));
  }

  if (!Array.isArray(parsed.fields)) {
    markers.push(createMarker("Plugin definition is missing required field 'fields'.", fieldsPair?.value?.range ?? root.range, lineCounter));
  }

  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    markers.push(createMarker("Plugin definition must define at least one step.", stepsPair?.value?.range ?? root.range, lineCounter));
  }

  if (!Array.isArray(parsed.dashboard?.metrics) || parsed.dashboard.metrics.length === 0) {
    markers.push(createMarker("Plugin definition must define at least one dashboard metric.", dashboardPair?.value?.range ?? root.range, lineCounter));
  }
}

function validateFields(
  root: YAMLMap,
  parsed: PluginDefinitionShape,
  lineCounter: LineCounter,
  markers: Monaco.editor.IMarkerData[],
) {
  const fieldsNode = findPair(root, "fields")?.value;
  if (!isSeq(fieldsNode) || !Array.isArray(parsed.fields)) {
    return;
  }

  const seen = new Map<string, number[]>();

  fieldsNode.items.forEach((item, index) => {
    if (!isMap(item)) {
      return;
    }

    const field = parsed.fields?.[index];
    const namePair = findPair(item, "name");
    const labelPair = findPair(item, "label");
    const typePair = findPair(item, "type");
    const name = field?.name?.trim();
    const label = field?.label?.trim();
    const type = field?.type?.trim();

    if (!name) {
      markers.push(createMarker("Each field must define 'name'.", namePair?.value?.range ?? item.range, lineCounter));
    } else {
      const indexes = seen.get(name) ?? [];
      indexes.push(index);
      seen.set(name, indexes);
    }

    if (!label) {
      markers.push(createMarker("Each field must define 'label'.", labelPair?.value?.range ?? item.range, lineCounter));
    }

    if (!type) {
      markers.push(createMarker("Each field must define 'type'.", typePair?.value?.range ?? item.range, lineCounter));
    } else if (!FIELD_TYPES.includes(type as (typeof FIELD_TYPES)[number])) {
      markers.push(createMarker(`Unsupported field type '${type}'.`, typePair?.value?.range ?? item.range, lineCounter));
    }
  });

  for (const [name, indexes] of seen) {
    if (indexes.length < 2) {
      continue;
    }

    for (const index of indexes) {
      const item = fieldsNode.items[index];
      if (isMap(item)) {
        markers.push(createMarker(`Duplicate field name '${name}'.`, findPair(item, "name")?.value?.range ?? item.range, lineCounter));
      }
    }
  }
}

function validateSteps(
  root: YAMLMap,
  parsed: PluginDefinitionShape,
  lineCounter: LineCounter,
  markers: Monaco.editor.IMarkerData[],
) {
  const stepsNode = findPair(root, "steps")?.value;
  if (!isSeq(stepsNode) || !Array.isArray(parsed.steps)) {
    return;
  }

  const seen = new Map<string, number[]>();

  stepsNode.items.forEach((item, index) => {
    if (!isMap(item)) {
      return;
    }

    const step = parsed.steps?.[index] ?? {};
    const namePair = findPair(item, "name");
    const methodPair = findPair(item, "method");
    const urlPair = findPair(item, "url");
    const responseTypePair = findPair(item, "responseType");
    const stepName = step.name?.trim();
    const method = step.method?.trim();
    const url = step.url?.trim();
    const responseType = step.responseType?.trim();

    if (!stepName) {
      markers.push(createMarker("Each step must define 'name'.", namePair?.value?.range ?? item.range, lineCounter));
    } else {
      const indexes = seen.get(stepName) ?? [];
      indexes.push(index);
      seen.set(stepName, indexes);
    }

    if (!method) {
      markers.push(createMarker("Each step must define 'method'.", methodPair?.value?.range ?? item.range, lineCounter));
    } else if (!HTTP_METHODS.includes(method.toUpperCase() as (typeof HTTP_METHODS)[number])) {
      markers.push(createMarker(`Unsupported HTTP method '${method}'.`, methodPair?.value?.range ?? item.range, lineCounter));
    }

    if (!url) {
      markers.push(createMarker("Each step must define 'url'.", urlPair?.value?.range ?? item.range, lineCounter));
    }

    if (!responseType) {
      markers.push(createMarker("Each step must define 'responseType'.", responseTypePair?.value?.range ?? item.range, lineCounter));
    } else if (!RESPONSE_TYPES.includes(responseType as (typeof RESPONSE_TYPES)[number])) {
      markers.push(createMarker(`Unsupported responseType '${responseType}'.`, responseTypePair?.value?.range ?? item.range, lineCounter));
    }

    const extractNode = findPair(item, "extract")?.value;
    if (isMap(extractNode)) {
      for (const entry of extractNode.items) {
        if (!isMap(entry.value)) {
          continue;
        }

        const ruleNode = entry.value;
        const transformPair = findPair(ruleNode, "transform");
        const regexPair = findPair(ruleNode, "regex");
        const pathPair = findPair(ruleNode, "path");
        const countMatchesPair = findPair(ruleNode, "countMatches");
        const transform = getScalarValue(transformPair?.value);
        const hasRegex = Boolean(getScalarValue(regexPair?.value)?.toString().trim());
        const hasPath = Boolean(getScalarValue(pathPair?.value)?.toString().trim());
        const countMatches = getScalarValue(countMatchesPair?.value) === true;

        if (transform && !TRANSFORMS.includes(String(transform) as (typeof TRANSFORMS)[number])) {
          markers.push(createMarker(`Unsupported transform '${transform}'.`, transformPair?.value?.range ?? ruleNode.range, lineCounter));
        }

        if (countMatches && !hasRegex) {
          markers.push(createMarker("Extract rules with 'countMatches: true' must also define 'regex'.", countMatchesPair?.value?.range ?? ruleNode.range, lineCounter));
        }

        if (hasPath && responseType !== "json") {
          markers.push(createMarker("JSON 'path' extraction can only be used when responseType is 'json'.", pathPair?.value?.range ?? ruleNode.range, lineCounter));
        }

        if (!hasRegex && !hasPath) {
          markers.push(createMarker("Extract rules must define either 'regex' or 'path'.", ruleNode.range, lineCounter));
        }
      }
    }

    const validateNode = findPair(item, "validate")?.value;
    if (isSeq(validateNode)) {
      validateNode.items.forEach((validationItem) => {
        if (!isMap(validationItem)) {
          return;
        }

        const fieldPair = findPair(validationItem, "field");
        const rulePair = findPair(validationItem, "rule");
        const onFailPair = findPair(validationItem, "onFail");
        const field = getScalarValue(fieldPair?.value)?.toString();
        const rule = getScalarValue(rulePair?.value)?.toString();
        const onFail = getScalarValue(onFailPair?.value)?.toString();
        const extractedFields = step.extract ? Object.keys(step.extract) : [];

        if (!field) {
          markers.push(createMarker("Each validation rule must define 'field'.", fieldPair?.value?.range ?? validationItem.range, lineCounter));
        } else if (!extractedFields.includes(field)) {
          markers.push(createMarker(`Validation references unknown extracted field '${field}'.`, fieldPair?.value?.range ?? validationItem.range, lineCounter));
        }

        if (rule && !VALIDATION_RULES.includes(rule as (typeof VALIDATION_RULES)[number])) {
          markers.push(createMarker(`Unsupported validation rule '${rule}'.`, rulePair?.value?.range ?? validationItem.range, lineCounter));
        }

        if (onFail && !VALIDATION_FAILURES.includes(onFail as (typeof VALIDATION_FAILURES)[number])) {
          markers.push(createMarker(`Unsupported onFail value '${onFail}'.`, onFailPair?.value?.range ?? validationItem.range, lineCounter));
        }
      });
    }
  });

  for (const [name, indexes] of seen) {
    if (indexes.length < 2) {
      continue;
    }

    for (const index of indexes) {
      const item = stepsNode.items[index];
      if (isMap(item)) {
        markers.push(createMarker(`Duplicate step name '${name}'.`, findPair(item, "name")?.value?.range ?? item.range, lineCounter));
      }
    }
  }
}

function validateMapping(
  root: YAMLMap,
  parsed: PluginDefinitionShape,
  lineCounter: LineCounter,
  markers: Monaco.editor.IMarkerData[],
) {
  const mappingNode = findPair(root, "mapping")?.value;
  if (!isMap(mappingNode) || !parsed.mapping) {
    return;
  }

  const fieldNames = new Set(parsed.fields?.map((field) => field.name).filter(Boolean) as string[]);
  const stepExtracts = new Map<string, Set<string>>();

  parsed.steps?.forEach((step) => {
    if (!step.name) {
      return;
    }

    stepExtracts.set(step.name, new Set(Object.keys(step.extract ?? {})));
  });

  for (const item of mappingNode.items) {
    if (!isScalar(item.key)) {
      continue;
    }

    const targetKey = String(item.key.value);
    const expr = getScalarValue(item.value)?.toString();
    if (!expr) {
      markers.push(createMarker(`Mapping field '${targetKey}' is required.`, item.value?.range ?? mappingNode.range, lineCounter));
      continue;
    }

    const references = expr.match(/steps\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|fields\.[A-Za-z0-9_-]+/g) ?? [];
    for (const reference of references) {
      if (reference.startsWith("fields.")) {
        const fieldName = reference.slice("fields.".length);
        if (!fieldNames.has(fieldName)) {
          markers.push(createMarker(`Mapping references unknown field '${fieldName}'.`, item.value?.range ?? mappingNode.range, lineCounter));
        }
        continue;
      }

      const [, stepName, extractedField] = reference.split(".");
      const extracted = stepExtracts.get(stepName);
      if (!extracted) {
        markers.push(createMarker(`Mapping references unknown step '${stepName}'.`, item.value?.range ?? mappingNode.range, lineCounter));
      } else if (!extracted.has(extractedField)) {
        markers.push(createMarker(`Mapping references unknown extracted value '${reference}'.`, item.value?.range ?? mappingNode.range, lineCounter));
      }
    }
  }
}

function validateDashboard(
  root: YAMLMap,
  parsed: PluginDefinitionShape,
  lineCounter: LineCounter,
  markers: Monaco.editor.IMarkerData[],
) {
  const dashboardNode = findPair(root, "dashboard")?.value;
  const metricsNode = findPair(dashboardNode, "metrics")?.value;
  if (!isSeq(metricsNode) || !Array.isArray(parsed.dashboard?.metrics)) {
    return;
  }

  metricsNode.items.forEach((item, index) => {
    if (!isMap(item)) {
      return;
    }

    const metric = parsed.dashboard?.metrics?.[index] ?? {};
    const statPair = findPair(item, "stat");
    const labelPair = findPair(item, "label");
    const formatPair = findPair(item, "format");
    const iconPair = findPair(item, "icon");
    const tonePair = findPair(item, "tone");

    if (!metric.stat) {
      markers.push(createMarker("Each dashboard metric must define 'stat'.", statPair?.value?.range ?? item.range, lineCounter));
    } else if (!DASHBOARD_STATS.includes(metric.stat as (typeof DASHBOARD_STATS)[number])) {
      markers.push(createMarker(`Unsupported dashboard stat '${metric.stat}'.`, statPair?.value?.range ?? item.range, lineCounter));
    }

    if (!metric.label?.trim()) {
      markers.push(createMarker("Each dashboard metric must define 'label'.", labelPair?.value?.range ?? item.range, lineCounter));
    }

    if (!metric.format) {
      markers.push(createMarker("Each dashboard metric must define 'format'.", formatPair?.value?.range ?? item.range, lineCounter));
    } else if (!DASHBOARD_FORMATS.includes(metric.format as (typeof DASHBOARD_FORMATS)[number])) {
      markers.push(createMarker(`Unsupported dashboard format '${metric.format}'.`, formatPair?.value?.range ?? item.range, lineCounter));
    }

    if (metric.icon && !DASHBOARD_ICONS.includes(metric.icon as (typeof DASHBOARD_ICONS)[number])) {
      markers.push(createMarker(`Unsupported dashboard icon '${metric.icon}'.`, iconPair?.value?.range ?? item.range, lineCounter));
    }

    if (metric.tone && !DASHBOARD_TONES.includes(metric.tone as (typeof DASHBOARD_TONES)[number])) {
      markers.push(createMarker(`Unsupported dashboard tone '${metric.tone}'.`, tonePair?.value?.range ?? item.range, lineCounter));
    }
  });
}

function validateTemplates(
  root: YAMLMap,
  parsed: PluginDefinitionShape,
  lineCounter: LineCounter,
  markers: Monaco.editor.IMarkerData[],
) {
  const fieldNames = new Set(parsed.fields?.map((field) => field.name).filter(Boolean) as string[]);
  const stepNames = new Set(parsed.steps?.map((step) => step.name).filter(Boolean) as string[]);
  const stepExtracts = new Map<string, Set<string>>();

  parsed.steps?.forEach((step) => {
    if (step.name) {
      stepExtracts.set(step.name, new Set(Object.keys(step.extract ?? {})));
    }
  });

  const httpNode = findPair(root, "http")?.value;
  if (isMap(httpNode)) {
    validateTemplateScalar(findPair(httpNode, "baseUrl")?.value, lineCounter, markers, fieldNames, stepNames, stepExtracts, false);

    const headersNode = findPair(httpNode, "headers")?.value;
    if (isMap(headersNode)) {
      headersNode.items.forEach((pair) => validateTemplateScalar(pair.value, lineCounter, markers, fieldNames, stepNames, stepExtracts, false));
    }

    const cookiesNode = findPair(httpNode, "cookies")?.value;
    if (isMap(cookiesNode)) {
      cookiesNode.items.forEach((pair) => validateTemplateScalar(pair.value, lineCounter, markers, fieldNames, stepNames, stepExtracts, false));
    }
  }

  const stepsNode = findPair(root, "steps")?.value;
  if (isSeq(stepsNode)) {
    stepsNode.items.forEach((item) => {
      if (isMap(item)) {
        validateTemplateScalar(findPair(item, "url")?.value, lineCounter, markers, fieldNames, stepNames, stepExtracts, true);
      }
    });
  }
}

function validateTemplateScalar(
  node: unknown,
  lineCounter: LineCounter,
  markers: Monaco.editor.IMarkerData[],
  fieldNames: Set<string>,
  stepNames: Set<string>,
  stepExtracts: Map<string, Set<string>>,
  allowStepReferences: boolean,
) {
  const value = getScalarValue(node);
  if (typeof value !== "string") {
    return;
  }

  const matches = value.match(/\{\{([^}]+)\}\}/g) ?? [];
  for (const match of matches) {
    const token = match.slice(2, -2).trim();

    if (token.startsWith("fields.")) {
      const fieldName = token.slice("fields.".length);
      if (!fieldNames.has(fieldName)) {
        markers.push(createMarker(`Template references unknown field '${fieldName}'.`, (node as { range?: [number, number, number] }).range, lineCounter));
      }
      continue;
    }

    if (token.startsWith("steps.")) {
      if (!allowStepReferences) {
        markers.push(createMarker("Step references are only supported in templated step URLs.", (node as { range?: [number, number, number] }).range, lineCounter));
        continue;
      }

      const [, stepName, extractedField] = token.split(".");
      if (!stepNames.has(stepName)) {
        markers.push(createMarker(`Template references unknown step '${stepName}'.`, (node as { range?: [number, number, number] }).range, lineCounter));
      } else if (!stepExtracts.get(stepName)?.has(extractedField)) {
        markers.push(createMarker(`Template references unknown extracted value '${token}'.`, (node as { range?: [number, number, number] }).range, lineCounter));
      }
      continue;
    }

    if (!fieldNames.has(token)) {
      markers.push(createMarker(`Template references unknown field '${token}'.`, (node as { range?: [number, number, number] }).range, lineCounter));
    }
  }
}

function createCompletionProvider(monaco: typeof Monaco): Monaco.languages.CompletionItemProvider {
  return {
    triggerCharacters: [":", ".", "{", "-", " "],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      const line = model.getLineContent(position.lineNumber);
      const linePrefix = line.slice(0, position.column - 1);
      const keyMatch = line.match(/^\s*([A-Za-z][A-Za-z0-9_-]*)\s*:/);
      const activeKey = keyMatch?.[1] ?? null;
      const topLevelSection = findActiveTopLevelSection(model, position.lineNumber);
      const state = getDocumentState(model.getValue());
      const suggestions: Monaco.languages.CompletionItem[] = [];

      addSnippetSuggestions(suggestions, range, monaco);

      if (activeKey) {
        addEnumSuggestions(suggestions, range, activeKey, monaco);
      }

      if (topLevelSection === "mapping" || /\b(?:steps|fields)\.[A-Za-z0-9_.-]*$/.test(linePrefix)) {
        suggestions.push(...buildReferenceSuggestions(state, range, monaco));
      }

      if (linePrefix.includes("{{")) {
        suggestions.push(...buildTemplateSuggestions(state, range, monaco, topLevelSection === "steps"));
      }

      if (linePrefix.trim().length === 0 || /^(\s*-?\s*)?$/.test(linePrefix)) {
        suggestions.push(...buildRootKeySuggestions(range, monaco));
      }

      return { suggestions };
    },
  };
}

function createHoverProvider(monaco: typeof Monaco): Monaco.languages.HoverProvider {
  return {
    provideHover(model, position) {
      const reference = getReferenceAtPosition(model, position);
      if (reference) {
        return {
          range: new monaco.Range(position.lineNumber, reference.startColumn, position.lineNumber, reference.endColumn),
          contents: [{ value: reference.message }],
        };
      }

      const word = model.getWordAtPosition(position);
      if (!word) {
        return null;
      }

      const message = ROOT_COMPLETION_DOCS[word.word] ?? VALUE_DOCS[word.word];
      if (!message) {
        return null;
      }

      return {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        contents: [{ value: message }],
      };
    },
  };
}

function addSnippetSuggestions(
  suggestions: Monaco.languages.CompletionItem[],
  range: Monaco.IRange,
  monaco: typeof Monaco,
) {
  suggestions.push(
    {
      label: "plugin skeleton",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: "Insert a full TrackArr plugin definition scaffold.",
      range,
      insertText: [
        "pluginId: ${1:custom-plugin}",
        "displayName: ${2:Custom Plugin}",
        "fields:",
        "  - name: ${3:cron}",
        "    label: ${4:Sync Schedule}",
        "    type: cron",
        "    required: true",
        "    sensitive: false",
        "steps:",
        "  - name: ${5:fetchStats}",
        "    method: GET",
        "    url: ${6:api/user}",
        "    responseType: json",
        "    extract:",
        "      ${7:ratio}:",
        "        path: ${8:data.ratio}",
        "        transform: decimal",
        "mapping:",
        "  ratio: steps.${5:fetchStats}.${7:ratio}",
        "dashboard:",
        "  metrics:",
        "    - stat: ratio",
        "      label: Ratio",
        "      format: text",
        "      icon: arrow-up",
        "      tone: primary",
      ].join("\n"),
    },
    {
      label: "field item",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: "Insert a plugin field definition.",
      range,
      insertText: ["- name: ${1:fieldName}", "  label: ${2:Field Label}", "  type: ${3|text,number,password,cron|}", "  required: ${4|true,false|}", "  sensitive: ${5|false,true|}"].join("\n"),
    },
    {
      label: "step item",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: "Insert a step definition scaffold.",
      range,
      insertText: ["- name: ${1:stepName}", "  method: ${2|GET,POST,PUT,DELETE|}", "  url: ${3:api/user}", "  responseType: ${4|json,html|}", "  extract:", "    ${5:value}:", "      ${6|path,regex|}: ${7:data.value}", "      transform: ${8|toString,decimal,integer,byteSize|}"].join("\n"),
    },
    {
      label: "validation rule",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: "Insert a step validation rule.",
      range,
      insertText: ["- field: ${1:username}", "  rule: notEmpty", "  onFail: ${2|unknownError,authFailed|}"].join("\n"),
    },
    {
      label: "dashboard metric",
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: "Insert a dashboard metric definition.",
      range,
      insertText: ["- stat: ${1|uploadedBytes,downloadedBytes,ratio,seedBonus,buffer,hitAndRuns,requiredRatio,seedingTorrents,leechingTorrents,activeTorrents|}", "  label: ${2:Metric Label}", "  format: ${3|bytes,count,text|}", "  icon: ${4|arrow-up,arrow-down,coins,hard-drive,shield-alert|}", "  tone: ${5|primary,success,warning,destructive,muted|}"].join("\n"),
    },
  );
}

function addEnumSuggestions(
  suggestions: Monaco.languages.CompletionItem[],
  range: Monaco.IRange,
  activeKey: string,
  monaco: typeof Monaco,
) {
  const enumMap: Record<string, readonly string[]> = {
    type: FIELD_TYPES,
    method: HTTP_METHODS,
    responseType: RESPONSE_TYPES,
    transform: TRANSFORMS,
    rule: VALIDATION_RULES,
    onFail: VALIDATION_FAILURES,
    stat: DASHBOARD_STATS,
    format: DASHBOARD_FORMATS,
    icon: DASHBOARD_ICONS,
    tone: DASHBOARD_TONES,
  };

  const values = enumMap[activeKey];
  if (!values) {
    return;
  }

  for (const value of values) {
    suggestions.push({
      label: value,
      kind: monaco.languages.CompletionItemKind.EnumMember,
      insertText: value,
      range,
      documentation: VALUE_DOCS[value] ?? undefined,
    });
  }
}

function buildReferenceSuggestions(
  state: ReturnType<typeof getDocumentState>,
  range: Monaco.IRange,
  monaco: typeof Monaco,
) {
  const suggestions: Monaco.languages.CompletionItem[] = [];

  for (const field of state.fields) {
    suggestions.push({
      label: `fields.${field}`,
      kind: monaco.languages.CompletionItemKind.Variable,
      insertText: `fields.${field}`,
      range,
      documentation: `Reference configured field \`${field}\`.`,
    });
  }

  for (const [stepName, extractedFields] of state.stepExtracts) {
    for (const extractedField of extractedFields) {
      suggestions.push({
        label: `steps.${stepName}.${extractedField}`,
        kind: monaco.languages.CompletionItemKind.Variable,
        insertText: `steps.${stepName}.${extractedField}`,
        range,
        documentation: `Reference extracted value \`${extractedField}\` from step \`${stepName}\`.`,
      });
    }
  }

  return suggestions;
}

function buildTemplateSuggestions(
  state: ReturnType<typeof getDocumentState>,
  range: Monaco.IRange,
  monaco: typeof Monaco,
  allowStepReferences: boolean,
) {
  const suggestions: Monaco.languages.CompletionItem[] = [];

  for (const field of state.fields) {
    suggestions.push({
      label: `{{${field}}}`,
      kind: monaco.languages.CompletionItemKind.Variable,
      insertText: `{{${field}}}`,
      range,
      documentation: `Interpolate field \`${field}\`.`,
    });
    suggestions.push({
      label: `{{fields.${field}}}`,
      kind: monaco.languages.CompletionItemKind.Variable,
      insertText: `{{fields.${field}}}`,
      range,
      documentation: `Interpolate field \`${field}\` using explicit field syntax.`,
    });
  }

  if (allowStepReferences) {
    for (const [stepName, extractedFields] of state.stepExtracts) {
      for (const extractedField of extractedFields) {
        suggestions.push({
          label: `{{steps.${stepName}.${extractedField}}}`,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: `{{steps.${stepName}.${extractedField}}}`,
          range,
          documentation: `Interpolate extracted value \`${extractedField}\` from step \`${stepName}\`.`,
        });
      }
    }
  }

  return suggestions;
}

function buildRootKeySuggestions(range: Monaco.IRange, monaco: typeof Monaco) {
  return Object.entries(ROOT_COMPLETION_DOCS).map(([key, documentation]) => ({
    label: key,
    kind: monaco.languages.CompletionItemKind.Property,
    insertText: `${key}: `,
    range,
    documentation,
  }));
}

function getDocumentState(source: string) {
  const document = parseDocument(source, { prettyErrors: false });
  const parsed = (document.toJS() ?? {}) as PluginDefinitionShape;

  return {
    fields: (parsed.fields ?? []).map((field) => field.name).filter(Boolean) as string[],
    stepExtracts: new Map(
      (parsed.steps ?? [])
        .filter((step) => step.name)
        .map((step) => [step.name as string, Object.keys(step.extract ?? {})]),
    ),
  };
}

function findActiveTopLevelSection(model: Monaco.editor.ITextModel, lineNumber: number) {
  for (let currentLine = lineNumber; currentLine >= 1; currentLine -= 1) {
    const line = model.getLineContent(currentLine);
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*$/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function getReferenceAtPosition(model: Monaco.editor.ITextModel, position: Monaco.Position) {
  const line = model.getLineContent(position.lineNumber);
  const patterns = [
    {
      regex: /\bsteps\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      formatter: (token: string) => {
        const [, stepName, fieldName] = token.split(".");
        return `Reference to extracted value \`${fieldName}\` from step \`${stepName}\`.`;
      },
    },
    {
      regex: /\bfields\.[A-Za-z0-9_-]+\b/g,
      formatter: (token: string) => `Reference to configured field \`${token.slice("fields.".length)}\`.`,
    },
    {
      regex: /\{\{[^}]+\}\}/g,
      formatter: (token: string) => `Interpolated template value \`${token}\`. TrackArr resolves these placeholders at runtime.`,
    },
  ];

  for (const pattern of patterns) {
    for (const match of line.matchAll(pattern.regex)) {
      const token = match[0];
      const index = match.index ?? 0;
      const startColumn = index + 1;
      const endColumn = startColumn + token.length;
      if (position.column >= startColumn && position.column <= endColumn) {
        return {
          startColumn,
          endColumn,
          message: pattern.formatter(token),
        };
      }
    }
  }

  return null;
}

function findPair(node: unknown, key: string) {
  if (!isMap(node)) {
    return null;
  }

  return node.items.find((item) => isScalar(item.key) && String(item.key.value) === key) ?? null;
}

function getScalarValue(node: unknown) {
  if (!isScalar(node)) {
    return null;
  }

  return (node as Scalar).value ?? null;
}

function createMarker(
  message: string,
  range: [number, number, number] | [number, number] | undefined,
  lineCounter: LineCounter,
): Monaco.editor.IMarkerData {
  const startOffset = range?.[0] ?? 0;
  const endOffset = Math.max(startOffset + 1, range?.[1] ?? startOffset + 1);
  const start = lineCounter.linePos(startOffset);
  const end = lineCounter.linePos(endOffset);

  return {
    severity: 8,
    message,
    startLineNumber: start.line,
    startColumn: start.col,
    endLineNumber: end.line,
    endColumn: end.col,
  };
}

function createMarkerForFullDocument(message: string): Monaco.editor.IMarkerData {
  return {
    severity: 8,
    message,
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: 1,
    endColumn: 1,
  };
}
