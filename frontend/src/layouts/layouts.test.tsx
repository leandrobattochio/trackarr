import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { NavLink } from "@/layouts/NavLink";
import { AppSidebar } from "@/layouts/AppSidebar";
import { appReport, whatsNewReport } from "@/features/whats-new/test-data";
import { WhatsNewContext } from "@/features/whats-new/whats-new-context";

let sidebarState: "expanded" | "collapsed" = "expanded";

vi.mock("lucide-react", () => ({
  CircleHelp: () => <svg data-testid="icon-help" />,
  ChartLine: () => <svg data-testid="icon-snapshots" />,
  LayoutDashboard: () => <svg data-testid="icon-dashboard" />,
  Puzzle: () => <svg data-testid="icon-plugins" />,
  Settings2: () => <svg data-testid="icon-settings" />,
  Sparkles: () => <svg data-testid="icon-whats-new" />,
  ArrowUpCircle: () => <svg data-testid="icon-update" />,
}));

vi.mock("@/features/plugins/components/OutdatedOverridesBanner", () => ({
  OutdatedOverridesBanner: () => <div data-testid="outdated-overrides-banner" />,
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
  SidebarMenuButton: ({ children, asChild, ...props }: React.ComponentProps<"button"> & { asChild?: boolean }) =>
    asChild ? <div>{children}</div> : <button {...props}>{children}</button>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
  useSidebar: () => ({ state: sidebarState }),
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
    expect(screen.getByTestId("outdated-overrides-banner")).toBeInTheDocument();
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

    sidebarState = "collapsed";
    rerender(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByText("TrackArr")).not.toBeInTheDocument();
  });

  it("opens What's New from the menu and shows the update notice", () => {
    sidebarState = "expanded";
    const open = vi.fn();
    const release = { version: "0.5.0", tagName: "v0.5.0", name: null, url: "https://example.test/v0.5.0", publishedAt: null, notes: "" };
    const report = whatsNewReport({ app: appReport({ updateAvailable: true, latestRelease: release }) });

    const { rerender } = render(
      <MemoryRouter>
        <WhatsNewContext.Provider value={{ open, report }}>
          <AppSidebar />
        </WhatsNewContext.Provider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "What's New" }));
    expect(open).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "trackarr v0.5.0 available" })).toHaveAttribute("href", release.url);

    sidebarState = "collapsed";
    rerender(
      <MemoryRouter>
        <WhatsNewContext.Provider value={{ open, report }}>
          <AppSidebar />
        </WhatsNewContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("icon-whats-new")).toBeInTheDocument();
    expect(screen.queryByText("trackarr v0.5.0 available")).not.toBeInTheDocument();
  });
});
