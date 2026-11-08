import { Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePageTitle } from "@/shared/hooks/use-page-title";

const pluginKinds = [
  {
    title: "Official",
    badge: "Official v1.2.0",
    description:
      "Published in the trackarr-plugins repository and downloaded on every start. Only the download changes them.",
  },
  {
    title: "Override",
    badge: "Edited (base v1.1.0)",
    description:
      "Your edited copy of an official plugin. It records the official version it was based on and is never overwritten by the download.",
  },
  {
    title: "Custom",
    badge: "Custom v1.0.0",
    description: "A plugin you created with New Plugin. The download never touches it.",
  },
];

const changeSteps = [
  "Open Manage Plugins and select the plugin. Plugins are changed only here: editing the files on disk is not supported.",
  "Change the YAML, click Test to dry-run it with one of its integrations, then Save.",
  "Saving an official plugin keeps your copy as an override; the official file is never changed. Saving with no change creates nothing.",
  "To go back to the official version, edit your copy until it matches the official one and save: the override is discarded.",
  "When a newer official version exists, a banner links to the review screen with both diffs, Use official (deletes your copy with no backup) and Keep mine.",
  "New Plugin creates a custom plugin. Its id uses lowercase letters and digits separated by hyphens, must not be an official id, and the YAML needs schemaVersion: 1. A custom plugin cannot be deleted while an integration uses it.",
];

const statusBadges = [
  { badge: "Outdated", description: "Your override is based on an older official version than the one installed." },
  { badge: "Orphan", description: "The official plugin was removed upstream; your override keeps working." },
  { badge: "Deprecated", description: "The official plugin was removed upstream but an integration still uses the cached copy." },
  { badge: "Incompatible", description: "A newer official version needs a newer trackarr; the last compatible version is kept." },
];

const yamlFlow = [
  {
    id: "01",
    title: "Identity",
    fields: ["pluginId", "displayName", "version", "schemaVersion", "changelog"],
    details: [
      "`pluginId` is the stable identifier used by integrations, API routes, and the YAML file itself.",
      "`displayName` is the human-readable label shown in the UI.",
      "`version` is the plugin's semver version, and `schemaVersion` the YAML format it uses (`1`, required in custom plugins).",
      "`changelog` lists what changed in each version and is shown in What's New.",
    ],
  },
  {
    id: "02",
    title: "Inputs",
    fields: ["baseUrls", "fields", "customFields"],
    details: [
      "`baseUrls` is required and defines the allowed tracker host choices shown in the integration forms.",
      "Each item defines `name`, `label`, `type`, `required`, and `sensitive`.",
      "These fields are rendered in the integration form and validated by the backend.",
      "Engine-owned input values like `required_ratio` and `cron` should not be declared here.",
      "The runtime `baseUrl` value is also engine-owned, but its allowed options come from `baseUrls` above.",
      "`customFields` uses the same shape as `fields` and can be omitted if not needed.",
    ],
  },
  {
    id: "03",
    title: "Request Setup",
    fields: ["http", "authFailure"],
    details: [
      "Supports `headers` and `cookies`.",
      "`http.baseUrl` is engine-owned and resolved from the selected `baseUrls` entry at runtime.",
      "Supports `httpStatusCodes` and `htmlPatterns`.",
      "Use this when a tracker returns a login page or auth-related status instead of valid stats.",
    ],
  },
  {
    id: "04",
    title: "Fetch",
    fields: ["steps"],
    details: [
      "Each step defines `name`, `method`, `url`, `responseType`, `extract`, and optional `validate` rules.",
      "Use `path` for JSON responses and `regex` for HTML responses.",
      "Use `transform` to normalize extracted values such as decimals, byte sizes, or strings.",
      "Use `countMatches` when you want to count repeated HTML matches instead of extracting a named value.",
    ],
  },
  {
    id: "05",
    title: "Map",
    fields: ["mapping"],
    details: [
      "Expressions can reference step outputs like `steps.fetchStats.ratio`.",
      "This is where raw extracted values become app stats such as `ratio`, `uploadedBytes`, `downloadedBytes`, `seedBonus`, or torrent counts.",
    ],
  },
  {
    id: "06",
    title: "Display",
    fields: ["dashboard"],
    details: [
      "Supports `byteUnitSystem` and a `metrics` list.",
      "Each metric defines `stat`, `label`, `format`, `icon`, and `tone`.",
      "The `stat` should point to a value produced by the mapping section.",
    ],
  },
];

export default function HelpPage() {
  usePageTitle("TrackArr | Help");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold">Help</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            How plugins work, how to change them, and the YAML structure of a plugin.
          </p>
        </div>

        <Card className="border-border/50 bg-card/95">
          <CardHeader>
            <CardTitle>Plugins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-muted-foreground">
            <p className="max-w-4xl">
              Every integration runs one plugin. trackarr downloads the official plugins on every start; the result is
              shown in Settings &gt; About, and updated plugins appear in What&apos;s New. When an id has more than one
              plugin, your override wins over a custom plugin, which wins over the official one.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              {pluginKinds.map((kind) => (
                <div key={kind.title} className="space-y-2 rounded-2xl border border-border/60 bg-muted/10 p-4">
                  <h3 className="font-display text-base font-semibold text-foreground">{kind.title}</h3>
                  <span className="inline-block rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-foreground">
                    {kind.badge}
                  </span>
                  <p>{kind.description}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="font-display text-base font-semibold text-foreground">Changing a plugin</h3>
              <ol className="max-w-4xl list-decimal space-y-1 pl-5">
                {changeSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>

            <div className="space-y-2">
              <h3 className="font-display text-base font-semibold text-foreground">Status badges</h3>
              <dl className="grid max-w-4xl gap-2 sm:grid-cols-[auto_1fr] sm:gap-x-4">
                {statusBadges.map((status) => (
                  <Fragment key={status.badge}>
                    <dt className="font-medium text-foreground">{status.badge}</dt>
                    <dd>{status.description}</dd>
                  </Fragment>
                ))}
              </dl>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/95">
          <CardHeader>
            <CardTitle>Plugin YAML Flow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="max-w-4xl text-sm text-muted-foreground">
              Read the file in this order: name the plugin, define what the user must fill in, describe how requests work, fetch data, map the extracted values, then choose what appears on the tracker card.
            </p>

            <ol className="space-y-4">
              {yamlFlow.map((section, index) => (
                <Fragment key={section.id}>
                  <li key={section.id} className="list-none">
                    <div className="rounded-2xl border border-border/60 bg-muted/10 p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background text-xs font-semibold text-muted-foreground">
                              {section.id}
                            </div>
                            <h2 className="font-display text-lg font-semibold text-foreground">{section.title}</h2>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {section.fields.map((field) => (
                              <span
                                key={field}
                                className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-foreground"
                              >
                                {field}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="min-w-0 max-w-2xl space-y-2 text-sm text-muted-foreground">
                          {section.details.map((detail, detailIndex) => (
                            <p key={`${section.id}-${detailIndex}`}>{detail}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </li>

                  {index < yamlFlow.length - 1 && (
                    <li
                      aria-hidden="true"
                      role="presentation"
                      className="flex justify-center list-none"
                    >
                      <div
                        aria-hidden="true"
                        role="presentation"
                        className="flex flex-col items-center gap-1 text-muted-foreground"
                      >
                        <div className="h-4 w-px bg-border" />
                        <div className="text-xs tracking-[0.2em]">DOWN</div>
                        <div className="text-lg leading-none">v</div>
                      </div>
                    </li>
                  )}
                </Fragment>
              ))}
            </ol>

            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/5 p-4 text-sm text-muted-foreground">
              Result: the YAML starts as plugin metadata, turns into request/extraction logic, and ends as mapped dashboard output.
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
