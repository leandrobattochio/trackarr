export function getRatioColor(ratio: number): string {
  if (ratio >= 2) return "text-success";
  if (ratio >= 1) return "text-primary";
  if (ratio >= 0.8) return "text-warning";
  return "text-destructive";
}

// The backend stores no ratio when the tracker reports an infinite one, which happens before the first download.
export function isInfiniteRatio(ratio: number | null, downloaded: number | null): boolean {
  return ratio === null && downloaded === 0;
}

export function isBelowRequiredRatio(ratio: number | null, requiredRatio: number | null): boolean {
  return ratio !== null && requiredRatio !== null && ratio < requiredRatio;
}
