import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "react-router-dom";
import { snapshotsApi } from "@/features/snapshots/api";
import { defaultSnapshotRange, isSnapshotRangeKey, type SnapshotRangeKey } from "@/features/snapshots/range";
import type { SnapshotFilters } from "@/features/snapshots/types";

export function useSnapshots(filters: SnapshotFilters, enabled: boolean) {
  return useQuery({
    queryKey: ["snapshots", filters.integrationId, filters.range, filters.from, filters.to],
    queryFn: () => snapshotsApi.list(filters),
    enabled,
  });
}

function toLocalDateTimeInputValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function getDefaultCustomRange() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  return {
    from: toLocalDateTimeInputValue(oneHourAgo),
    to: toLocalDateTimeInputValue(now),
  };
}

export function useSnapshotFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCustomRange = useMemo(() => getDefaultCustomRange(), []);
  const initialIntegrationId = searchParams.get("integrationId") ?? "";
  const initialRangeParam = searchParams.get("range");
  const initialRange: SnapshotRangeKey = isSnapshotRangeKey(initialRangeParam)
    ? initialRangeParam
    : defaultSnapshotRange;
  const initialFrom = searchParams.get("from") ?? initialCustomRange.from;
  const initialTo = searchParams.get("to") ?? initialCustomRange.to;

  const [integrationId, setIntegrationId] = useState(initialIntegrationId);
  const [range, setRange] = useState<SnapshotRangeKey>(initialRange);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [submittedFilters, setSubmittedFilters] = useState<SnapshotFilters>({
    integrationId: initialIntegrationId,
    range: initialRange,
    from: initialRange === "custom" ? initialFrom : undefined,
    to: initialRange === "custom" ? initialTo : undefined,
  });
  const [activeFilterAction, setActiveFilterAction] = useState<"apply" | null>(null);
  const [isFilterTransitionPending, startFilterTransition] = useTransition();

  useEffect(() => {
    if (!initialIntegrationId)
      return;

    setSearchParams({
      integrationId: initialIntegrationId,
      range: initialRange,
      ...(initialRange === "custom" ? { from: initialFrom, to: initialTo } : {}),
    }, { replace: true });
  }, [initialFrom, initialIntegrationId, initialRange, initialTo, setSearchParams]);

  function applyFilters(nextIntegrationId: string, nextRange: SnapshotRangeKey, nextFrom: string, nextTo: string) {
    startFilterTransition(() => {
      setActiveFilterAction("apply");

      const nextFilters: SnapshotFilters = {
        integrationId: nextIntegrationId,
        range: nextRange,
        from: nextRange === "custom" ? nextFrom : undefined,
        to: nextRange === "custom" ? nextTo : undefined,
      };

      setSubmittedFilters(nextFilters);
      setSearchParams({
        integrationId: nextIntegrationId,
        range: nextRange,
        ...(nextRange === "custom" ? { from: nextFrom, to: nextTo } : {}),
      });
    });
  }

  function handleApplyFilters() {
    if (!integrationId)
      return;

    applyFilters(integrationId, range, from, to);
  }

  function handleIntegrationChange(nextIntegrationId: string) {
    setIntegrationId(nextIntegrationId);

    if (!nextIntegrationId || (range === "custom" && (!from || !to)))
      return;

    applyFilters(nextIntegrationId, range, from, to);
  }

  function handleRangeChange(nextRange: SnapshotRangeKey) {
    setRange(nextRange);

    if (!integrationId || nextRange === "custom")
      return;

    applyFilters(integrationId, nextRange, from, to);
  }

  function handleResetFilters() {
    const defaultCustomRange = getDefaultCustomRange();

    setActiveFilterAction(null);
    setFrom(defaultCustomRange.from);
    setTo(defaultCustomRange.to);
  }

  const clearActiveFilterAction = useCallback(() => {
    setActiveFilterAction(null);
  }, []);

  return {
    integrationId,
    range,
    from,
    to,
    submittedFilters,
    activeFilterAction,
    isFilterTransitionPending,
    clearActiveFilterAction,
    setFrom,
    setTo,
    handleApplyFilters,
    handleIntegrationChange,
    handleRangeChange,
    handleResetFilters,
  };
}
