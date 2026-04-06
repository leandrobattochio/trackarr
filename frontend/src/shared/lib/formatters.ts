export type ByteUnitSystem = "binary" | "decimal";

export function formatBytes(bytes: number, unitSystem: ByteUnitSystem = "binary"): string {
  if (bytes === 0) return "0 B";

  const k = unitSystem === "decimal" ? 1000 : 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
