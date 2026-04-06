import { useEffect, useMemo, useState, type DragEvent } from "react";
import type { TrackerIntegration } from "@/features/integrations/types";

export const DASHBOARD_CARD_ORDER_STORAGE_KEY = "trackarr.dashboard.card-order";

function readStoredCardOrder() {
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

export function reorderDashboardCardOrder(order: string[], draggedId: string, targetId: string) {
  if (draggedId === targetId)
    return order;

  const draggedIndex = order.indexOf(draggedId);
  const targetIndex = order.indexOf(targetId);

  if (draggedIndex === -1 || targetIndex === -1)
    return order;

  const nextOrder = order.filter((id) => id !== draggedId);
  nextOrder.splice(targetIndex, 0, draggedId);
  return nextOrder;
}

function areOrdersEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function useDashboardCardOrder(integrations: TrackerIntegration[]) {
  const [cardOrder, setCardOrder] = useState<string[]>(() => readStoredCardOrder());
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dropTargetCardId, setDropTargetCardId] = useState<string | null>(null);

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

    return [...integrations].sort((left, right) => (sortIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (sortIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER));
  }, [cardOrder, integrations]);

  function handleCardDragStart(cardId: string) {
    setDraggedCardId(cardId);
    setDropTargetCardId(null);
  }

  function handleCardDragOver(event: DragEvent<HTMLDivElement>, targetCardId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (draggedCardId && draggedCardId !== targetCardId)
      setDropTargetCardId(targetCardId);
  }

  function handleCardDrop(targetCardId: string, sourceCardId?: string) {
    const activeDraggedCardId = sourceCardId || draggedCardId;

    if (!activeDraggedCardId || activeDraggedCardId === targetCardId)
      return;

    setCardOrder((currentOrder) => reorderDashboardCardOrder(
      normalizeDashboardCardOrder(integrations, currentOrder),
      activeDraggedCardId,
      targetCardId,
    ));
    setDraggedCardId(null);
    setDropTargetCardId(null);
  }

  function handleCardDragEnd() {
    setDraggedCardId(null);
    setDropTargetCardId(null);
  }

  function moveCard(cardId: string, direction: -1 | 1) {
    setCardOrder((currentOrder) => {
      const normalizedOrder = normalizeDashboardCardOrder(integrations, currentOrder);
      const currentIndex = normalizedOrder.indexOf(cardId);
      const targetIndex = currentIndex + direction;

      if (currentIndex === -1 || targetIndex < 0 || targetIndex >= normalizedOrder.length)
        return normalizedOrder;

      const nextOrder = [...normalizedOrder];
      const [movedCardId] = nextOrder.splice(currentIndex, 1);
      nextOrder.splice(targetIndex, 0, movedCardId);
      return nextOrder;
    });
  }

  return {
    orderedIntegrations,
    draggedCardId,
    dropTargetCardId,
    handleCardDragStart,
    handleCardDragOver,
    handleCardDrop,
    handleCardDragEnd,
    moveCard,
  };
}
