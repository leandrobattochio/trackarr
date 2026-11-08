import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrackerReorderButtons } from "@/features/integrations/components/TrackerReorderButtons";

describe("TrackerReorderButtons", () => {
  it("disables the direction the tracker cannot move to", () => {
    render(<TrackerReorderButtons trackerName="Seedpool" canMoveUp={false} canMoveDown onMove={vi.fn()} />);

    expect(screen.getByLabelText("Move Seedpool up")).toBeDisabled();
    expect(screen.getByLabelText("Move Seedpool down")).toBeEnabled();
  });

  it("moves the tracker up or down", () => {
    const onMove = vi.fn();
    render(<TrackerReorderButtons trackerName="Seedpool" canMoveUp canMoveDown onMove={onMove} />);

    fireEvent.click(screen.getByLabelText("Move Seedpool up"));
    fireEvent.click(screen.getByLabelText("Move Seedpool down"));

    expect(onMove).toHaveBeenNthCalledWith(1, -1);
    expect(onMove).toHaveBeenNthCalledWith(2, 1);
  });

  it("does not let a click bubble up or a mouse down start a drag", () => {
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <TrackerReorderButtons trackerName="Seedpool" canMoveUp canMoveDown onMove={vi.fn()} />
      </div>,
    );
    const button = screen.getByLabelText("Move Seedpool down");
    const mouseDown = createEvent.mouseDown(button);

    fireEvent(button, mouseDown);
    fireEvent.click(button);

    expect(mouseDown.defaultPrevented).toBe(true);
    expect(parentClick).not.toHaveBeenCalled();
  });
});
