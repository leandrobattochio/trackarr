import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePageTitle } from "@/shared/hooks/use-page-title";

describe("usePageTitle", () => {
  it("updates the document title", () => {
    document.title = "Initial Title";

    const { rerender } = renderHook(({ title }) => usePageTitle(title), {
      initialProps: { title: "Dashboard" },
    });

    expect(document.title).toBe("Dashboard");

    rerender({ title: "Snapshots" });
    expect(document.title).toBe("Snapshots");
  });
});
