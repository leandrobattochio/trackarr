import type { ApiPluginStatus } from "@/features/plugins/types";

export type PluginBadgeKind = "official" | "edited" | "custom" | "outdated" | "orphan" | "deprecated" | "incompatible";

export interface PluginBadge {
  kind: PluginBadgeKind;
  label: string;
}

export interface PluginNotice {
  kind: "orphan" | "deprecated" | "incompatible" | "hiddenOfficial";
  message: string;
}

type PluginStatusInput = Pick<ApiPluginStatus,
  "origin" | "version" | "baseVersion" | "orphan" | "deprecated" | "incompatible" | "outdated" | "latestOfficialVersion"
  | "incompatibleVersion" | "requiredAppVersion" | "incompatibleMessage" | "hiddenOfficial"> & { pluginId: string };

function withVersion(label: string, version: string | null) {
  return version ? `${label} v${version}` : label;
}

/** An official plugin listed by the index that this trackarr cannot install has no file yet. */
export function isNotInstalled(plugin: PluginStatusInput) {
  return plugin.incompatible && plugin.origin === "official" && !plugin.version;
}

export function isOutdatedOverride(plugin: Pick<ApiPluginStatus, "origin" | "outdated">) {
  return plugin.outdated && plugin.origin === "override";
}

export function getOutdatedOverrides<T extends Pick<ApiPluginStatus, "origin" | "outdated">>(plugins: T[]) {
  return plugins.filter(isOutdatedOverride);
}

export function getOutdatedMessage(plugin: Pick<ApiPluginStatus, "baseVersion" | "latestOfficialVersion">) {
  const official = withVersion("A newer official version", plugin.latestOfficialVersion);
  const base = plugin.baseVersion ? ` Your edited copy is based on v${plugin.baseVersion}.` : "";
  return `${official} is available.${base}`;
}

export function getOutdatedToneClass(lastSyncFailed: boolean) {
  return lastSyncFailed
    ? "border-destructive/50 bg-destructive/15 text-destructive"
    : "border-warning/40 bg-warning/10 text-warning";
}

export function getSaveHint(origin: ApiPluginStatus["origin"] | undefined) {
  if (origin === "custom") return "Save writes your custom plugin.";
  if (origin === "override") return "Save updates your override. A copy that matches the official version again is discarded.";
  return "Save keeps your changes as an override; the official plugin file is never changed.";
}

export function getPluginEditorPath(pluginId: string) {
  return `/plugins?plugin=${encodeURIComponent(pluginId)}`;
}

export function getOutdatedReviewPath(pluginId: string) {
  return `/plugins/${encodeURIComponent(pluginId)}/update`;
}

function getOriginBadge(plugin: PluginStatusInput): PluginBadge {
  switch (plugin.origin) {
    case "override":
      return { kind: "edited", label: plugin.baseVersion ? `Edited (base v${plugin.baseVersion})` : "Edited" };
    case "custom":
      return { kind: "custom", label: withVersion("Custom", plugin.version) };
    default:
      return { kind: "official", label: withVersion("Official", plugin.version) };
  }
}

export function getPluginBadges(plugin: PluginStatusInput): PluginBadge[] {
  const badges = isNotInstalled(plugin) ? [] : [getOriginBadge(plugin)];
  if (isOutdatedOverride(plugin)) {
    const official = plugin.latestOfficialVersion ? ` (official v${plugin.latestOfficialVersion})` : "";
    badges.push({ kind: "outdated", label: `Outdated${official}` });
  }
  if (plugin.orphan) badges.push({ kind: "orphan", label: "Orphan" });
  if (plugin.deprecated) badges.push({ kind: "deprecated", label: "Deprecated" });
  if (plugin.incompatible) badges.push({ kind: "incompatible", label: "Incompatible" });
  return badges;
}

function getIncompatibleMessage(plugin: PluginStatusInput) {
  if (plugin.requiredAppVersion) {
    const target = withVersion(plugin.pluginId, plugin.incompatibleVersion);
    return `Requires trackarr ${plugin.requiredAppVersion} or later: update trackarr to receive ${target}.`;
  }

  return plugin.incompatibleMessage ?? "Requires a newer trackarr: update trackarr to receive this plugin.";
}

export function getPluginNotices(plugin: PluginStatusInput): PluginNotice[] {
  const notices: PluginNotice[] = [];
  if (plugin.orphan) {
    notices.push({
      kind: "orphan",
      message: "Removed from the official repository. Your edited copy keeps working but gets no more updates.",
    });
  }
  if (plugin.deprecated) {
    notices.push({
      kind: "deprecated",
      message: "Removed from the official repository. The cached copy keeps working for your integrations.",
    });
  }
  if (plugin.incompatible) {
    notices.push({ kind: "incompatible", message: getIncompatibleMessage(plugin) });
  }
  if (plugin.origin === "custom" && plugin.hiddenOfficial) {
    notices.push({
      kind: "hiddenOfficial",
      message: `An official plugin also uses the id ${plugin.pluginId}. Your custom plugin takes precedence, so the official one is hidden.`,
    });
  }
  return notices;
}
