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
  it("renders YAML flow sections and transition connectors", () => {
    render(<HelpPage />);

    expect(pageTitleSpy).toHaveBeenCalledWith("TrackArr | Help");
    expect(screen.getByTestId("dashboard-layout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Help" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Plugin YAML Flow" })).toBeInTheDocument();

    expect(screen.getByText("Identity")).toBeInTheDocument();
    expect(screen.getByText("Inputs")).toBeInTheDocument();
    expect(screen.getByText("Request Setup")).toBeInTheDocument();
    expect(screen.getByText("Fetch")).toBeInTheDocument();
    expect(screen.getByText("Map")).toBeInTheDocument();
    expect(screen.getByText("Display")).toBeInTheDocument();

    expect(screen.getByText("pluginId")).toBeInTheDocument();
    expect(screen.getByText("baseUrls")).toBeInTheDocument();
    expect(screen.getByText("customFields")).toBeInTheDocument();
    expect(screen.getByText("authFailure")).toBeInTheDocument();
    expect(screen.getByText("steps")).toBeInTheDocument();
    expect(screen.getByText("mapping")).toBeInTheDocument();
    expect(screen.getByText("dashboard")).toBeInTheDocument();

    expect(screen.getAllByText("DOWN")).toHaveLength(5);
  });

  it("explains the plugin kinds, how to change a plugin and the status badges", () => {
    render(<HelpPage />);

    expect(screen.getByRole("heading", { name: "Plugins" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Official" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Override" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Custom" })).toBeInTheDocument();
    expect(screen.getByText("Edited (base v1.1.0)")).toBeInTheDocument();
    expect(screen.getByText(/downloads the official plugins on every start/i)).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Changing a plugin" })).toBeInTheDocument();
    expect(screen.getByText(/editing the files on disk is not supported/i)).toBeInTheDocument();
    expect(screen.getByText(/Use official \(deletes your copy with no backup\)/)).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Status badges" })).toBeInTheDocument();
    for (const badge of ["Outdated", "Orphan", "Deprecated", "Incompatible"]) {
      expect(screen.getByText(badge)).toBeInTheDocument();
    }
    expect(screen.getByText("schemaVersion")).toBeInTheDocument();
    expect(screen.getByText(/Result: the YAML starts as plugin metadata/i)).toBeInTheDocument();
  });
});

