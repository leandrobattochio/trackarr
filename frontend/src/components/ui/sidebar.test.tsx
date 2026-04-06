import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let isMobile = false;

vi.mock("lucide-react", () => ({
  PanelLeft: () => <svg data-testid="panel-left" />,
}));

vi.mock("@radix-ui/react-slot", () => ({
  Slot: ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { children: React.ReactElement }) =>
    <span data-testid="slot" {...props}>{children}</span>,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => isMobile,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => <button data-testid="button" onClick={onClick} {...props}>{children}</button>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({ ...props }: any) => <input data-testid="sidebar-input-base" {...props} />,
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: ({ ...props }: any) => <div data-testid="sidebar-separator-base" {...props} />,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open, onOpenChange }: any) => (
    <div data-testid="sheet" data-open={String(open)} onClick={() => onOpenChange?.(false)}>
      {children}
    </div>
  ),
  SheetContent: ({ children, side, ...props }: any) => <div data-testid="sheet-content" data-side={side} {...props}>{children}</div>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ ...props }: any) => <div data-testid="sidebar-skeleton-base" {...props} />,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: any) => <div data-testid="tooltip-provider">{children}</div>,
  Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
  TooltipTrigger: ({ children }: any) => <div data-testid="tooltip-trigger">{children}</div>,
  TooltipContent: ({ children, hidden, ...props }: any) => <div data-testid="tooltip-content" data-hidden={String(hidden)} {...props}>{children}</div>,
}));

import {
  getInitialSidebarOpenState,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

function SidebarHarness({
  defaultOpen = true,
  open,
  onOpenChange,
  tooltip = "Tooltip text",
}: {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  tooltip?: string | { children: React.ReactNode };
}) {
  return (
    <SidebarProvider defaultOpen={defaultOpen} open={open} onOpenChange={onOpenChange}>
      <Sidebar variant="floating" collapsible="icon">
        <SidebarHeader>Header</SidebarHeader>
        <SidebarInput placeholder="Search" />
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Group</SidebarGroupLabel>
            <SidebarGroupAction>+</SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip={tooltip} isActive>
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction showOnHover>Edit</SidebarMenuAction>
                  <SidebarMenuBadge>7</SidebarMenuBadge>
                </SidebarMenuItem>
              </SidebarMenu>
              <SidebarMenuSkeleton showIcon />
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton isActive size="sm">Nested</SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>Footer</SidebarFooter>
      </Sidebar>
      <SidebarInset>Inset</SidebarInset>
      <SidebarTrigger />
      <SidebarRail />
    </SidebarProvider>
  );
}

function SidebarStateButton({ nextOpen }: { nextOpen: boolean }) {
  const { setOpen } = useSidebar();

  return <button onClick={() => setOpen(nextOpen)}>Set Sidebar</button>;
}

describe("sidebar ui", () => {
  it("throws when useSidebar is used outside the provider", () => {
    function Outside() {
      useSidebar();
      return null;
    }

    expect(() => render(<Outside />)).toThrow("useSidebar must be used within a SidebarProvider.");
  });

  it("reads initial sidebar state from cookies and falls back when document is unavailable", () => {
    const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");

    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "sidebar:state=true",
    });
    expect(getInitialSidebarOpenState(false)).toBe(true);

    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "sidebar:state=false",
    });
    expect(getInitialSidebarOpenState(true)).toBe(false);

    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "other=value",
    });
    expect(getInitialSidebarOpenState(true)).toBe(true);

    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: undefined,
    });

    try {
      expect(getInitialSidebarOpenState(false)).toBe(false);
    } finally {
      delete (originalDocument as Document & { cookie?: string }).cookie;
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: originalDocument,
      });
      if (cookieDescriptor) {
        Object.defineProperty(Document.prototype, "cookie", cookieDescriptor);
      }
    }
  });

  it("renders desktop sidebar components and toggles state via trigger, rail, and keyboard", () => {
    document.cookie = "sidebar:state=false";
    render(<SidebarHarness defaultOpen />);

    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-input-base")).toHaveAttribute("data-sidebar", "input");
    expect(screen.getByTestId("sidebar-separator-base")).toHaveAttribute("data-sidebar", "separator");
    expect(screen.getByText("Inset")).toBeInTheDocument();
    expect(screen.getByText("Dashboard").closest("[data-sidebar='menu-button']")).toHaveAttribute("data-active", "true");
    expect(screen.getByText("Nested").closest("[data-sidebar='menu-sub-button']")).toHaveAttribute("data-size", "sm");
    expect(screen.getAllByTestId("sidebar-skeleton-base")).toHaveLength(2);
    expect(screen.getByTestId("tooltip-content")).toHaveAttribute("data-hidden", "false");

    fireEvent.click(screen.getAllByTestId("button")[0]);
    expect(document.cookie).toContain("sidebar:state=true");

    fireEvent.click(screen.getAllByRole("button", { name: "Toggle Sidebar" })[0]);
    expect(document.cookie).toContain("sidebar:state=false");

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(document.cookie).toContain("sidebar:state=true");
  });

  it("supports controlled open state and menu button without tooltip", () => {
    const onOpenChange = vi.fn();
    render(<SidebarHarness open={false} onOpenChange={onOpenChange} tooltip={{ children: "Object tooltip" }} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Toggle Sidebar" })[0]);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("tooltip-content")).toHaveTextContent("Object tooltip");
  });

  it("supports direct boolean sidebar state updates and trigger click handlers", () => {
    const onOpenChange = vi.fn();
    const onTriggerClick = vi.fn();

    render(
      <SidebarProvider open={false} onOpenChange={onOpenChange}>
        <SidebarTrigger onClick={onTriggerClick} />
        <SidebarStateButton nextOpen />
      </SidebarProvider>,
    );

    fireEvent.click(screen.getByText("Set Sidebar"));
    expect(onOpenChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
    expect(onTriggerClick).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
  });

  it("renders mobile and non-collapsible sidebars", () => {
    isMobile = true;
    const { rerender } = render(
      <SidebarProvider>
        <Sidebar>Mobile body</Sidebar>
        <SidebarTrigger />
      </SidebarProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
    expect(screen.getByTestId("sheet")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("sheet-content")).toHaveTextContent("Mobile body");

    isMobile = false;
    rerender(
      <SidebarProvider>
        <Sidebar collapsible="none">Static body</Sidebar>
      </SidebarProvider>,
    );

    expect(screen.getByText("Static body")).toBeInTheDocument();
  });

  it("covers right-side desktop layout branches and menu buttons without tooltips", () => {
    isMobile = false;
    document.cookie = "sidebar:state=false";
    render(
      <SidebarProvider defaultOpen={false}>
        <Sidebar side="right" variant="sidebar" collapsible="icon">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton variant="outline" size="lg">Plain</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </Sidebar>
      </SidebarProvider>,
    );

    const peer = screen.getByText("Plain").closest("[data-side='right']");
    expect(peer).toBeInTheDocument();
    expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
    expect(screen.getByText("Plain").closest("[data-sidebar='menu-button']")).toHaveAttribute("data-size", "lg");
  });

  it("covers asChild branches for group and menu buttons", () => {
    render(
      <SidebarProvider open>
        <Sidebar>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <span>Custom Group</span>
            </SidebarGroupLabel>
            <SidebarGroupAction asChild>
              <a href="/group-action">Group Action</a>
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Wrapped tooltip">
                    <a href="/wrapped">Wrapped Button</a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </Sidebar>
      </SidebarProvider>,
    );

    expect(screen.getByText("Custom Group").closest("[data-testid='slot']")).toBeInTheDocument();
    expect(screen.getByText("Group Action").closest("[data-testid='slot']")).toBeInTheDocument();
    expect(screen.getByText("Wrapped Button").closest("[data-testid='slot']")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-content")).toHaveAttribute("data-hidden", "true");
  });

  it("covers asChild menu action and sub-button branches", () => {
    render(
      <SidebarProvider>
        <Sidebar>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>Parent</SidebarMenuButton>
              <SidebarMenuAction asChild>
                <a href="/edit">Edit Link</a>
              </SidebarMenuAction>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarMenuSub>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton asChild size="md">
                <span>Sub Link</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </Sidebar>
      </SidebarProvider>,
    );

    expect(screen.getByText("Edit Link").closest("[data-testid='slot']")).toBeInTheDocument();
    expect(screen.getByText("Sub Link").closest("[data-testid='slot']")).toBeInTheDocument();
  });
});
