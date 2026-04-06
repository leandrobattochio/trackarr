import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

describe("toggle-group fallback props", () => {
  it("uses item props when the group does not provide variant or size", () => {
    render(
      <ToggleGroup type="single">
        <ToggleGroupItem value="fallback" variant="default" size="lg">
          Fallback
        </ToggleGroupItem>
      </ToggleGroup>,
    );

    expect(screen.getByRole("radio", { name: "Fallback" }).className).toContain("h-11 px-5");
    expect(screen.getByRole("radio", { name: "Fallback" }).className).toContain("bg-transparent");
  });
});
