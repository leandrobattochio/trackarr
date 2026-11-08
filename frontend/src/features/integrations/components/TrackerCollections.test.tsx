import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardCardOrder } from "@/features/integrations/dashboard-order";
import type { TrackerIntegration } from "@/features/integrations/types";
import { buildTracker } from "@/test/tracker-fixture";

vi.mock("@/features/integrations/components/TrackerCard", () => ({
  TrackerCard: ({ tracker, reorderControls }: { tracker: TrackerIntegration; reorderControls: ReactNode }) => (
    <div data-testid="card-content">{tracker.name}{reorderControls}</div>
  ),
}));

vi.mock("@/features/integrations/components/TrackerListRow", () => ({
  TrackerListRow: ({ tracker, reorderControls }: { tracker: TrackerIntegration; reorderControls: ReactNode }) => (
    <div data-testid="row-content">{tracker.name}{reorderControls}</div>
  ),
}));

import { TrackerCardGrid } from "@/features/integrations/components/TrackerCardGrid";
import { TrackerList } from "@/features/integrations/components/TrackerList";

const order: DashboardCardOrder = {
  orderedIntegrations: [buildTracker({ id: "int-1", name: "First" }), buildTracker({ id: "int-2", name: "Second" })],
  draggedCardId: null,
  dropTargetCardId: null,
  handleCardDragStart: vi.fn(),
  handleCardDragOver: vi.fn(),
  handleCardDrop: vi.fn(),
  handleCardDragEnd: vi.fn(),
  moveCard: vi.fn(),
};

describe("tracker collections", () => {
  it("renders one draggable card per tracker, in order, with its reorder buttons", () => {
    render(<TrackerCardGrid order={order} />);

    const cards = within(screen.getByTestId("dashboard-cards-grid")).getAllByTestId("tracker-card");
    expect(cards.map((card) => card.getAttribute("data-tracker-id"))).toEqual(["int-1", "int-2"]);
    expect(within(cards[0]).getByLabelText("Move First up")).toBeDisabled();
    expect(within(cards[1]).getByLabelText("Move Second down")).toBeDisabled();
  });

  it("renders a header and one draggable row per tracker, in order, with its reorder buttons", () => {
    render(<TrackerList order={order} />);

    const list = screen.getByTestId("dashboard-list");
    const rows = within(list).getAllByTestId("tracker-row");
    expect(within(list).getByText("Uploaded")).toBeInTheDocument();
    expect(rows.map((row) => row.getAttribute("data-tracker-id"))).toEqual(["int-1", "int-2"]);
    expect(within(rows[0]).getByLabelText("Move First up")).toBeDisabled();
    expect(within(rows[1]).getByLabelText("Move Second down")).toBeDisabled();
  });
});
