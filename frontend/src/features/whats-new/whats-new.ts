import type { ApiPluginChangelogEntry } from "@/features/plugins/types";
import type { ApiPluginUpdate } from "@/features/whats-new/types";

export interface PluginUpdateGroup {
  pluginId: string;
  isBase: boolean;
  displayName: string | null;
  fromVersion: string | null;
  toVersion: string;
  changelog: ApiPluginChangelogEntry[];
}

function parseVersion(version: string) {
  const withoutBuild = version.split("+")[0];
  const dash = withoutBuild.indexOf("-");
  const core = dash < 0 ? withoutBuild : withoutBuild.slice(0, dash);
  const prerelease = dash < 0 ? "" : withoutBuild.slice(dash + 1);
  return { parts: core.split(".").map((part) => Number(part) || 0), prerelease };
}

function comparePrerelease(left: string, right: string) {
  const a = left.split(".");
  const b = right.split(".");
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const aNumeric = /^\d+$/.test(a[index]);
    const bNumeric = /^\d+$/.test(b[index]);
    if (aNumeric && bNumeric) {
      const diff = Number(a[index]) - Number(b[index]);
      if (diff !== 0) return diff;
    } else if (aNumeric !== bNumeric) {
      return aNumeric ? -1 : 1;
    } else if (a[index] !== b[index]) {
      return a[index] < b[index] ? -1 : 1;
    }
  }
  return a.length - b.length;
}

export function compareVersions(left: string, right: string) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < Math.max(a.parts.length, b.parts.length); index++) {
    const diff = (a.parts[index] ?? 0) - (b.parts[index] ?? 0);
    if (diff !== 0) return diff;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return comparePrerelease(a.prerelease, b.prerelease);
}

// Updates arrive newest first; a plugin updated twice since the last read becomes one group.
export function groupPluginUpdates(updates: ApiPluginUpdate[]): PluginUpdateGroup[] {
  const groups = new Map<string, PluginUpdateGroup>();
  for (const update of updates) {
    // A base may share its id with a plugin, so bases are grouped apart.
    const key = `${update.isBase ? "base" : "plugin"}:${update.pluginId}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        pluginId: update.pluginId,
        isBase: update.isBase ?? false,
        displayName: update.displayName ?? null,
        fromVersion: update.fromVersion,
        toVersion: update.toVersion,
        changelog: [...update.changelog],
      });
      continue;
    }

    group.fromVersion = update.fromVersion;
    group.changelog.push(...update.changelog.filter((entry) => !group.changelog.some((known) => known.version === entry.version)));
  }

  return [...groups.values()].map((group) => ({
    ...group,
    changelog: [...group.changelog].sort((a, b) => compareVersions(b.version, a.version)),
  }));
}

export function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}
