export const snapshotChartConfig = {
  uploadedBytes: {
    label: "Uploaded",
    color: "hsl(var(--success))",
  },
  downloadedBytes: {
    label: "Downloaded",
    color: "hsl(var(--primary))",
  },
  ratio: {
    label: "Ratio",
    color: "hsl(262 83% 58%)",
  },
  seedingTorrents: {
    label: "Seeding",
    color: "hsl(174 72% 46%)",
  },
  leechingTorrents: {
    label: "Leeching",
    color: "hsl(38 92% 50%)",
  },
  activeTorrents: {
    label: "Active",
    color: "hsl(0 72% 58%)",
  },
};

export const transferSeriesOptions = [
  { key: "uploadedBytes", label: "Uploaded", strokeToken: "var(--color-uploadedBytes)", strokeWidth: 2.5 },
  { key: "downloadedBytes", label: "Downloaded", strokeToken: "var(--color-downloadedBytes)", strokeWidth: 2.5 },
] as const;

export const ratioSeriesOptions = [
  { key: "ratio", label: "Ratio", strokeToken: "var(--color-ratio)", strokeWidth: 2.5 },
] as const;

export const torrentSeriesOptions = [
  { key: "seedingTorrents", label: "Seeding", strokeToken: "var(--color-seedingTorrents)" },
  { key: "leechingTorrents", label: "Leeching", strokeToken: "var(--color-leechingTorrents)" },
  { key: "activeTorrents", label: "Active", strokeToken: "var(--color-activeTorrents)" },
] as const;

export type TransferSeriesKey = (typeof transferSeriesOptions)[number]["key"];
export type RatioSeriesKey = (typeof ratioSeriesOptions)[number]["key"];
export type TorrentSeriesKey = (typeof torrentSeriesOptions)[number]["key"];
