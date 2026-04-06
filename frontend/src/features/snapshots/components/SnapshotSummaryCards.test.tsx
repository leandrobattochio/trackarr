import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SnapshotSummaryCards } from "@/features/snapshots/components/SnapshotSummaryCards";

describe("SnapshotSummaryCards", () => {
  it("renders summary labels and values", () => {
    render(
      <SnapshotSummaryCards
        count={42}
        firstSnapshotLabel="2026-01-01 10:00"
        latestSnapshotLabel="2026-02-01 12:00"
      />,
    );

    expect(screen.getByText("Points")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("First Snapshot")).toBeInTheDocument();
    expect(screen.getByText("2026-01-01 10:00")).toBeInTheDocument();
    expect(screen.getByText("Latest Snapshot")).toBeInTheDocument();
    expect(screen.getByText("2026-02-01 12:00")).toBeInTheDocument();
  });
});
