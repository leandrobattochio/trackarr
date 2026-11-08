import { useEffect, useMemo, useState, type DragEvent } from "react";
import type { TrackerIntegration } from "@/features/integrations/types";
import { readLocalStorage, writeLocalStorage } from "@/shared/lib/local-storage";

export const DASHBOARD_CARD_ORDER_STORAGE_KEY = "trackarr.dashboard.card-order";

function parseStoredCardOrder(value: unknown) {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : undefined;
}

function readStoredCardOrder() {
  return readLocalStorage(DASHBOARD_CARD_ORDER_STORAGE_KEY, parseStoredCardOrder) ?? [];
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

    writeLocalStorage(DASHBOARD_CARD_ORDER_STORAGE_KEY, normalizeDashboardCardOrder(integrations, cardOrder));
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
    setDropTargetCardId(null);
  }

  function handleCardDragOver(event: DragEvent<HTMLElement>, targetCardId: string) {
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

export type DashboardCardOrder = ReturnType<typeof useDashboardCardOrder>;
