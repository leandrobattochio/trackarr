import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardViewToggle } from "@/features/integrations/components/DashboardViewToggle";

describe("DashboardViewToggle", () => {
  it("marks the current view as pressed", () => {
    render(<DashboardViewToggle value="list" onChange={vi.fn()} />);

    expect(screen.getByRole("radiogroup", { name: "Dashboard view" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "List view" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Cards view" })).not.toBeChecked();
  });

  it("reports the view that was picked", () => {
    const onChange = vi.fn();
    render(<DashboardViewToggle value="cards" onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("List view"));

    expect(onChange).toHaveBeenCalledWith("list");
  });

  it("keeps the view when the pressed item is clicked again", () => {
    const onChange = vi.fn();
    render(<DashboardViewToggle value="cards" onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("Cards view"));

    expect(onChange).not.toHaveBeenCalled();
  });
});
