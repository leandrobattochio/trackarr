import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotFoundPage from "@/pages/NotFoundPage";

describe("NotFoundPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the 404 content and logs the missing path", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={["/does-not-exist"]}>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Oops! Page not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Home" })).toHaveAttribute("href", "/");
    expect(errorSpy).toHaveBeenCalledWith("404 Error: User attempted to access non-existent route:", "/does-not-exist");
  });
});
