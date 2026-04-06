import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "@/app/router";

vi.mock("@/features/integrations", () => ({ DashboardPage: () => <div>Dashboard Page</div> }));
vi.mock("@/features/help/HelpPage", () => ({ default: () => <div>Help Page</div> }));
vi.mock("@/features/plugins/ManagePluginsPage", () => ({ default: () => <div>Plugins Page</div> }));
vi.mock("@/features/settings/SettingsPage", () => ({ default: () => <div>Settings Page</div> }));
vi.mock("@/features/snapshots/SnapshotsPage", () => ({ default: () => <div>Snapshots Page</div> }));
vi.mock("@/pages/NotFoundPage", () => ({ default: () => <div>Not Found Page</div> }));

describe("AppRouter", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("renders the matching route component", () => {
    window.history.pushState({}, "", "/plugins");
    render(<AppRouter />);

    expect(screen.getByText("Plugins Page")).toBeInTheDocument();
  });

  it("renders the not found route for unknown paths", () => {
    window.history.pushState({}, "", "/missing");
    render(<AppRouter />);

    expect(screen.getByText("Not Found Page")).toBeInTheDocument();
  });
});
