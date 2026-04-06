import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => ({
  Loader2: () => <svg data-testid="icon-loader" />,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: unknown) => <div>{children}</div>,
  CardHeader: ({ children }: unknown) => <div>{children}</div>,
  CardTitle: ({ children }: unknown) => <h2>{children}</h2>,
  CardContent: ({ children }: unknown) => <div>{children}</div>,
}));

import { AboutTab } from "@/features/settings/components/AboutTab";

describe("AboutTab", () => {
  it("renders loading and error states", () => {
    const { rerender } = render(
      <AboutTab isLoading error={null} aboutInfo={null} />,
    );
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();

    rerender(
      <AboutTab
        isLoading={false}
        error={new Error("about failed")}
        aboutInfo={null}
      />,
    );
    expect(screen.getByText("Failed to load system information: about failed")).toBeInTheDocument();
  });

  it("renders system information rows and docker yes/no values", () => {
    const aboutInfo = {
      version: "1.2.3",
      dotNetVersion: "10.0.0",
      runningInDocker: true,
      databaseEngine: "PostgreSQL",
      appliedMigrations: 8,
      appDataDirectory: "/data",
      startupDirectory: "/app",
      environmentName: "Production",
      uptime: "3 days",
    };

    const { rerender } = render(
      <AboutTab isLoading={false} error={null} aboutInfo={aboutInfo} />,
    );

    expect(screen.getByText("System Information")).toBeInTheDocument();
    expect(screen.getByText("Version")).toBeInTheDocument();
    expect(screen.getByText("1.2.3")).toBeInTheDocument();
    expect(screen.getByText("Docker")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Applied Migrations")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();

    rerender(
      <AboutTab
        isLoading={false}
        error={null}
        aboutInfo={{ ...aboutInfo, runningInDocker: false }}
      />,
    );
    expect(screen.getByText("No")).toBeInTheDocument();
  });
});

