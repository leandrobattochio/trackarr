import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReorderableTracker, TrackerOrderControls } from "@/features/integrations/components/ReorderableTracker";
import type { DashboardCardOrder } from "@/features/integrations/dashboard-order";
import { buildTracker } from "@/test/tracker-fixture";

const first = buildTracker({ id: "int-1", name: "First" });
const second = buildTracker({ id: "int-2", name: "Second", pluginId: "fearnopeer" });

function buildOrder(overrides: Partial<DashboardCardOrder> = {}): DashboardCardOrder {
  return {
    orderedIntegrations: [first, second],
    draggedCardId: null,
    dropTargetCardId: null,
    handleCardDragStart: vi.fn(),
    handleCardDragOver: vi.fn(),
    handleCardDrop: vi.fn(),
    handleCardDragEnd: vi.fn(),
    moveCard: vi.fn(),
    ...overrides,
  };
}

describe("ReorderableTracker", () => {
  it("wires the drag events to the order", () => {
    const order = buildOrder();
    render(
      <ReorderableTracker tracker={second} order={order} testId="tracker-row" className="extra">
        <span>Second</span>
      </ReorderableTracker>,
    );
    const item = screen.getByTestId("tracker-row");
    const dataTransfer = { effectAllowed: "", dropEffect: "", setData: vi.fn(), getData: vi.fn(() => "int-1") };

    fireEvent.dragStart(item, { dataTransfer });
    fireEvent.dragOver(item, { dataTransfer });
    fireEvent.drop(item, { dataTransfer });
    fireEvent.dragEnd(item);

    expect(item).toHaveAttribute("draggable", "true");
    expect(item).toHaveAttribute("data-tracker-id", "int-2");
    expect(item).toHaveAttribute("data-plugin-id", "fearnopeer");
    expect(item).toHaveClass("extra", "cursor-grab");
    expect(dataTransfer.effectAllowed).toBe("move");
    expect(dataTransfer.setData).toHaveBeenCalledWith("text/plain", "int-2");
    expect(order.handleCardDragStart).toHaveBeenCalledWith("int-2");
    expect(order.handleCardDragOver).toHaveBeenCalledWith(expect.anything(), "int-2");
    expect(order.handleCardDrop).toHaveBeenCalledWith("int-2", "int-1");
    expect(order.handleCardDragEnd).toHaveBeenCalled();
  });

  it("highlights the dragged item and the drop target", () => {
    const order = buildOrder({ draggedCardId: "int-1", dropTargetCardId: "int-2" });
    render(
      <>
        <ReorderableTracker tracker={first} order={order} testId="dragged"><span /></ReorderableTracker>
        <ReorderableTracker tracker={second} order={order} testId="target"><span /></ReorderableTracker>
      </>,
    );

    expect(screen.getByTestId("dragged")).toHaveClass("tracker-card-dragging", "cursor-grabbing");
    expect(screen.getByTestId("target")).toHaveClass("tracker-card-drop-target", "cursor-grab");
  });
});

describe("TrackerOrderControls", () => {
  it("lets the first tracker move only down and the last only up", () => {
    const order = buildOrder();
    render(
      <>
        <TrackerOrderControls tracker={first} order={order} index={0} />
        <TrackerOrderControls tracker={second} order={order} index={1} />
      </>,
    );

    expect(screen.getByLabelText("Move First up")).toBeDisabled();
    expect(screen.getByLabelText("Move Second down")).toBeDisabled();

    fireEvent.click(screen.getByLabelText("Move First down"));
    fireEvent.click(screen.getByLabelText("Move Second up"));

    expect(order.moveCard).toHaveBeenCalledWith("int-1", 1);
    expect(order.moveCard).toHaveBeenCalledWith("int-2", -1);
  });
});
