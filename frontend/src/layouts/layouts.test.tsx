import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { NavLink } from "@/layouts/NavLink";
import { AppSidebar } from "@/layouts/AppSidebar";

let sidebarState: "expanded" | "collapsed" = "expanded";
let updateCheckData: { updateAvailable: boolean; latestVersion: string | null } | undefined;

vi.mock("lucide-react", () => ({
  CircleHelp: () => <svg data-testid="icon-help" />,
  ChartLine: () => <svg data-testid="icon-snapshots" />,
  LayoutDashboard: () => <svg data-testid="icon-dashboard" />,
  Puzzle: () => <svg data-testid="icon-plugins" />,
  Settings2: () => <svg data-testid="icon-settings" />,
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-provider">{children}</div>,
  SidebarTrigger: () => <button type="button">Toggle Sidebar</button>,
  Sidebar: ({ children }: { children: React.ReactNode }) => <aside>{children}</aside>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
  useSidebar: () => ({ state: sidebarState }),
}));

vi.mock("@/features/settings/hooks", () => ({
  useUpdateCheck: () => ({ data: updateCheckData }),
}));

describe("layouts", () => {
  it("renders the dashboard shell with sidebar trigger and content", () => {
    render(
      <MemoryRouter>
        <DashboardLayout>
          <div>Page Content</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("sidebar-provider")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Sidebar" })).toBeInTheDocument();
    expect(screen.getByText("Page Content")).toBeInTheDocument();
  });

  it("applies active and pending classes through NavLink", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <NavLink to="/settings" className="base" activeClassName="active" pendingClassName="pending">
          Settings
        </NavLink>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Settings" })).toHaveClass("base", "active");
  });

  it("renders sidebar navigation and hides labels when collapsed", () => {
    sidebarState = "expanded";
    updateCheckData = { updateAvailable: true, latestVersion: "0.3.2" };
    const { rerender } = render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByText("TrackArr")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Snapshots")).toBeInTheDocument();
    expect(screen.getByText("Manage Plugins")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
    expect(screen.getByText("New update available: 0.3.2")).toBeInTheDocument();

    sidebarState = "collapsed";
    rerender(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByText("TrackArr")).not.toBeInTheDocument();
    expect(screen.queryByText("New update available: 0.3.2")).not.toBeInTheDocument();
  });
});
