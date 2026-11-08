import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pageTitleSpy = vi.fn();

vi.mock("@/layouts/DashboardLayout", () => ({
  DashboardLayout: ({ children }: unknown) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: unknown) => <div>{children}</div>,
  CardHeader: ({ children }: unknown) => <div>{children}</div>,
  CardTitle: ({ children }: unknown) => <h2>{children}</h2>,
  CardContent: ({ children }: unknown) => <div>{children}</div>,
}));

vi.mock("@/shared/hooks/use-page-title", () => ({
  usePageTitle: (...args: unknown[]) => pageTitleSpy(...args),
}));

import HelpPage from "@/features/help/HelpPage";

describe("HelpPage", () => {
  it("explains the plugin kinds and the status badges", () => {
    render(<HelpPage />);

    expect(pageTitleSpy).toHaveBeenCalledWith("TrackArr | Help");
    expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Help" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Plugins" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Official" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Override" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Custom" })).toBeInTheDocument();
    expect(screen.getByText("Edited (base v1.1.0)")).toBeInTheDocument();
    expect(screen.getByText(/downloads the official plugins on every start/i)).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Status badges" })).toBeInTheDocument();
    for (const badge of ["Outdated", "Orphan", "Deprecated", "Incompatible"]) {
      expect(screen.getByText(badge)).toBeInTheDocument();
    }
  });

  it("links to the wiki instead of explaining the YAML", () => {
    render(<HelpPage />);

    expect(screen.getByRole("heading", { name: "Documentation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Writing a plugin/ })).toHaveAttribute(
      "href",
      "https://github.com/leandrobattochio/trackarr/wiki/Writing-a-Plugin",
    );
    expect(screen.getByRole("link", { name: /Managing plugins/ })).toHaveAttribute("target", "_blank");
    expect(screen.queryByText("Plugin YAML Flow")).not.toBeInTheDocument();
    expect(screen.queryByText("schemaVersion")).not.toBeInTheDocument();
  });
});
