import { useEffect, useMemo, useState, type DragEvent } from "react";
import type { TrackerIntegration } from "@/features/integrations/types";

export const DASHBOARD_CARD_ORDER_STORAGE_KEY = "trackarr.dashboard.card-order";

export type DropSide = "before" | "after";

function readStoredCardOrder() {
  /* c8 ignore next 2 */
  if (typeof window === "undefined")
    return [];

  try {
    const rawValue = window.localStorage.getItem(DASHBOARD_CARD_ORDER_STORAGE_KEY);
    if (!rawValue)
      return [];

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeStoredCardOrder(order: string[]) {
  /* c8 ignore next 2 */
  if (typeof window === "undefined")
    return;

  try {
    window.localStorage.setItem(DASHBOARD_CARD_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch (error) {
    console.warn(`Failed to persist dashboard card order for ${DASHBOARD_CARD_ORDER_STORAGE_KEY}.`, error);
    return;
  }
}

export function normalizeDashboardCardOrder(integrations: TrackerIntegration[], order: string[]) {
  const integrationIds = integrations.map((integration) => integration.id);
  const integrationIdSet = new Set(integrationIds);
  const seen = new Set<string>();
  const dedupedOrder = order.filter((id) => {
    if (!integrationIdSet.has(id) || seen.has(id))
      return false;

    seen.add(id);
    return true;
  });
  const missingIds = integrationIds.filter((id) => !seen.has(id));

  return [...dedupedOrder, ...missingIds];
}

export function reorderDashboardCardOrder(order: string[], draggedId: string, targetId: string, side: DropSide) {
  if (draggedId === targetId)
    return order;

  const draggedIndex = order.indexOf(draggedId);
  const targetIndex = order.indexOf(targetId);

  if (draggedIndex === -1 || targetIndex === -1)
    return order;

  const nextOrder = order.filter((id) => id !== draggedId);
  const newTargetIndex = nextOrder.indexOf(targetId);
  const insertIndex = side === "before" ? newTargetIndex : newTargetIndex + 1;
  nextOrder.splice(insertIndex, 0, draggedId);
  return nextOrder;
}

function areOrdersEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function useDashboardCardOrder(integrations: TrackerIntegration[]) {
  const [cardOrder, setCardOrder] = useState<string[]>(() => readStoredCardOrder());
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; side: DropSide } | null>(null);

  useEffect(() => {
    if (integrations.length === 0)
      return;

    const normalizedOrder = normalizeDashboardCardOrder(integrations, cardOrder);

    if (!areOrdersEqual(normalizedOrder, cardOrder))
      setCardOrder(normalizedOrder);
  }, [cardOrder, integrations]);

  useEffect(() => {
    if (integrations.length === 0)
      return;

    writeStoredCardOrder(normalizeDashboardCardOrder(integrations, cardOrder));
  }, [cardOrder, integrations]);

  const orderedIntegrations = useMemo(() => {
    const normalizedOrder = normalizeDashboardCardOrder(integrations, cardOrder);
    const sortIndex = new Map(normalizedOrder.map((id, index) => [id, index]));

    return [...integrations].sort((left, right) => {
      const leftIndex = sortIndex.get(left.id) as number;
      const rightIndex = sortIndex.get(right.id) as number;
      return leftIndex - rightIndex;
    });
  }, [cardOrder, integrations]);

  function handleCardDragStart(cardId: string) {
    setDraggedCardId(cardId);
    setDropTarget(null);
  }

  function handleCardDragOver(event: DragEvent<HTMLDivElement>, targetCardId: string, side: DropSide) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (draggedCardId && draggedCardId !== targetCardId)
      setDropTarget({ id: targetCardId, side });
  }

  function handleCardDrop(targetCardId: string, sourceCardId: string | undefined, side: DropSide) {
    const activeDraggedCardId = sourceCardId || draggedCardId;

    if (!activeDraggedCardId || activeDraggedCardId === targetCardId)
      return;

    setCardOrder((currentOrder) => reorderDashboardCardOrder(
      normalizeDashboardCardOrder(integrations, currentOrder),
      activeDraggedCardId,
      targetCardId,
      side,
    ));
    setDraggedCardId(null);
    setDropTarget(null);
  }

  function handleCardDragEnd() {
    setDraggedCardId(null);
    setDropTarget(null);
  }

  return {
    orderedIntegrations,
    draggedCardId,
    dropTargetCardId: dropTarget?.id ?? null,
    dropTargetSide: dropTarget?.side ?? null,
    handleCardDragStart,
    handleCardDragOver,
    handleCardDrop,
    handleCardDragEnd,
  };
}
