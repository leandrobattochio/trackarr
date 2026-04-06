import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => ({
  Check: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-check" {...props} />,
  ChevronDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-chevron-down" {...props} />,
  ChevronUp: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-chevron-up" {...props} />,
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-x" {...props} />,
}));

vi.mock("@radix-ui/react-slot", () => ({
  Slot: ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { children: React.ReactElement }) =>
    <span data-testid="slot" {...props}>{children}</span>,
}));

vi.mock("@radix-ui/react-alert-dialog", () => {
  const React = require("react");
  const withRef = (tag: keyof JSX.IntrinsicElements, testId: string) =>
    React.forwardRef(({ children, ...props }, ref) => React.createElement(tag, { ref, "data-testid": testId, ...props }, children));
  return {
    Root: ({ children }: any) => <div data-testid="alert-root">{children}</div>,
    Trigger: withRef("button", "alert-trigger"),
    Portal: ({ children }: any) => <div data-testid="alert-portal">{children}</div>,
    Overlay: withRef("div", "alert-overlay"),
    Content: withRef("div", "alert-content"),
    Title: withRef("h2", "alert-title"),
    Description: withRef("p", "alert-description"),
    Action: withRef("button", "alert-action"),
    Cancel: withRef("button", "alert-cancel"),
  };
});

vi.mock("@radix-ui/react-dialog", () => {
  const React = require("react");
  const withRef = (tag: keyof JSX.IntrinsicElements, testId: string) =>
    React.forwardRef(({ children, ...props }, ref) => React.createElement(tag, { ref, "data-testid": testId, ...props }, children));
  return {
    Root: ({ children, open }: any) => <div data-testid="dialog-root" data-open={String(open ?? "")}>{children}</div>,
    Trigger: withRef("button", "dialog-trigger"),
    Portal: ({ children }: any) => <div data-testid="dialog-portal">{children}</div>,
    Close: withRef("button", "dialog-close"),
    Overlay: withRef("div", "dialog-overlay"),
    Content: withRef("div", "dialog-content"),
    Title: withRef("h2", "dialog-title"),
    Description: withRef("p", "dialog-description"),
  };
});

vi.mock("@radix-ui/react-checkbox", () => {
  const React = require("react");
  return {
    Root: React.forwardRef(({ children, ...props }, ref) => <button ref={ref} data-testid="checkbox-root" {...props}>{children}</button>),
    Indicator: React.forwardRef(({ children, ...props }, ref) => <span ref={ref} data-testid="checkbox-indicator" {...props}>{children}</span>),
  };
});

vi.mock("@radix-ui/react-label", () => {
  const React = require("react");
  return {
    Root: React.forwardRef(({ children, ...props }, ref) => <label ref={ref} data-testid="label-root" {...props}>{children}</label>),
  };
});

vi.mock("@radix-ui/react-scroll-area", () => {
  const React = require("react");
  return {
    Root: React.forwardRef(({ children, ...props }, ref) => <div ref={ref} data-testid="scroll-root" {...props}>{children}</div>),
    Viewport: React.forwardRef(({ children, ...props }, ref) => <div ref={ref} data-testid="scroll-viewport" {...props}>{children}</div>),
    ScrollAreaScrollbar: React.forwardRef(({ children, orientation, ...props }, ref) => (
      <div ref={ref} data-testid={`scrollbar-${orientation}`} data-orientation={orientation} {...props}>{children}</div>
    )),
    ScrollAreaThumb: React.forwardRef((props, ref) => <div ref={ref} data-testid="scroll-thumb" {...props} />),
    Corner: () => <div data-testid="scroll-corner" />,
  };
});

vi.mock("@radix-ui/react-separator", () => {
  const React = require("react");
  return {
    Root: React.forwardRef(({ children, orientation, decorative, ...props }, ref) => (
      <div ref={ref} data-testid="separator-root" data-orientation={orientation} data-decorative={String(decorative)} {...props}>{children}</div>
    )),
  };
});

vi.mock("@radix-ui/react-tabs", () => {
  const React = require("react");
  const Root = ({ children, value }: any) => <div data-testid="tabs-root" data-value={value}>{children}</div>;
  const List = React.forwardRef(({ children, ...props }, ref) => <div ref={ref} data-testid="tabs-list" {...props}>{children}</div>);
  const Trigger = React.forwardRef(({ children, value, ...props }, ref) => <button ref={ref} data-testid={`tabs-trigger-${value}`} {...props}>{children}</button>);
  const Content = React.forwardRef(({ children, value, ...props }, ref) => <div ref={ref} data-testid={`tabs-content-${value}`} {...props}>{children}</div>);
  return { Root, List, Trigger, Content };
});

vi.mock("@radix-ui/react-tooltip", () => {
  const React = require("react");
  return {
    Provider: ({ children }: any) => <div data-testid="tooltip-provider">{children}</div>,
    Root: ({ children }: any) => <div data-testid="tooltip-root">{children}</div>,
    Trigger: React.forwardRef(({ children, asChild, ...props }, ref) => <button ref={ref} data-testid="tooltip-trigger" data-as-child={String(!!asChild)} {...props}>{children}</button>),
    Content: React.forwardRef(({ children, sideOffset, ...props }, ref) => <div ref={ref} data-testid="tooltip-content" data-side-offset={sideOffset} {...props}>{children}</div>),
  };
});

vi.mock("@radix-ui/react-toggle-group", () => {
  const React = require("react");
  return {
    Root: React.forwardRef(({ children, type, value, ...props }, ref) => <div ref={ref} data-testid="toggle-root" data-type={type} data-value={value} {...props}>{children}</div>),
    Item: React.forwardRef(({ children, value, ...props }, ref) => <button ref={ref} data-testid={`toggle-item-${value}`} {...props}>{children}</button>),
  };
});

vi.mock("@radix-ui/react-select", () => {
  const React = require("react");
  const withRef = (tag: keyof JSX.IntrinsicElements, testId: string, extra?: (props: any) => any) =>
    React.forwardRef(({ children, ...props }, ref) => React.createElement(tag, { ref, "data-testid": testId, ...(extra ? extra(props) : {}), ...props }, children));
  return {
    Root: ({ children }: any) => <div data-testid="select-root">{children}</div>,
    Group: ({ children }: any) => <div data-testid="select-group">{children}</div>,
    Value: ({ children }: any) => <span data-testid="select-value">{children}</span>,
    Trigger: withRef("button", "select-trigger"),
    Icon: ({ children }: any) => <span data-testid="select-icon">{children}</span>,
    ScrollUpButton: withRef("button", "select-scroll-up"),
    ScrollDownButton: withRef("button", "select-scroll-down"),
    Portal: ({ children }: any) => <div data-testid="select-portal">{children}</div>,
    Content: withRef("div", "select-content", (props) => ({ "data-position": props.position })),
    Viewport: withRef("div", "select-viewport"),
    Label: withRef("div", "select-label"),
    Item: withRef("div", "select-item"),
    ItemIndicator: ({ children }: any) => <span data-testid="select-item-indicator">{children}</span>,
    ItemText: ({ children }: any) => <span data-testid="select-item-text">{children}</span>,
    Separator: withRef("div", "select-separator"),
  };
});

vi.mock("@radix-ui/react-toast", () => {
  const React = require("react");
  const withRef = (tag: keyof JSX.IntrinsicElements, testId: string) =>
    React.forwardRef(({ children, ...props }, ref) => React.createElement(tag, { ref, "data-testid": testId, ...props }, children));
  return {
    Provider: ({ children }: any) => <div data-testid="toast-provider">{children}</div>,
    Viewport: withRef("div", "toast-viewport"),
    Root: withRef("div", "toast-root"),
    Action: withRef("button", "toast-action"),
    Close: withRef("button", "toast-close"),
    Title: withRef("div", "toast-title"),
    Description: withRef("div", "toast-description"),
  };
});

vi.mock("sonner", () => ({
  Toaster: ({ theme, className, toastOptions, ...props }: any) => (
    <div
      data-testid="sonner-toaster"
      data-theme={theme}
      data-class-name={className}
      data-description-class={toastOptions?.classNames?.description}
      {...props}
    />
  ),
  toast: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toasts: [
      { id: "1", title: "Alpha", description: "First", open: true },
      { id: "2", description: "Second", open: true, action: <button>Action</button> },
    ],
  }),
}));

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster as SonnerToaster, toast as sonnerToast } from "@/components/ui/sonner";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toast, ToastAction, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { Toaster } from "@/components/ui/toaster";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

describe("ui wrappers", () => {
  it("renders badge and button variants", () => {
    render(
      <>
        <Badge variant="secondary">Badge</Badge>
        <Button variant="destructive" size="lg">Action</Button>
        <Button asChild><a href="/test">Child</a></Button>
      </>,
    );

    expect(screen.getByText("Badge").className).toContain("bg-secondary");
    expect(screen.getByRole("button", { name: "Action" }).className).toContain("bg-destructive");
    expect(screen.getByText("Child").closest("[data-testid='slot']")).toBeInTheDocument();
    expect(badgeVariants({ variant: "outline" })).toContain("text-foreground");
    expect(buttonVariants({ variant: "ghost", size: "icon" })).toContain("h-10 w-10");
  });

  it("renders card, input, label, skeleton, and separator wrappers", () => {
    render(
      <>
        <Card data-testid="card">
          <CardHeader data-testid="card-header">
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Content</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
        <Input placeholder="Type here" />
        <Label>Label text</Label>
        <Skeleton data-testid="skeleton" />
        <Separator orientation="vertical" />
      </>,
    );

    expect(screen.getByTestId("card").className).toContain("rounded-lg");
    expect(screen.getByTestId("card-header").className).toContain("p-6");
    expect(screen.getByText("Title").tagName).toBe("H3");
    expect(screen.getByPlaceholderText("Type here")).toHaveClass("h-10", "w-full");
    expect(screen.getByTestId("label-root").className).toContain("text-sm");
    expect(screen.getByTestId("skeleton").className).toContain("animate-pulse");
    expect(screen.getByTestId("separator-root")).toHaveAttribute("data-orientation", "vertical");
  });

  it("renders the default horizontal separator branch", () => {
    render(<Separator />);
    expect(screen.getByTestId("separator-root").className).toContain("h-[1px] w-full");
  });

  it("renders alert dialog and dialog wrappers", () => {
    render(
      <>
        <AlertDialog>
          <AlertDialogTrigger>Open alert</AlertDialogTrigger>
          <AlertDialogPortal>
            <AlertDialogOverlay />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Alert title</AlertDialogTitle>
                <AlertDialogDescription>Alert description</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction>Confirm</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogPortal>
        </AlertDialog>
        <Dialog>
          <DialogTrigger>Open dialog</DialogTrigger>
          <DialogPortal>
            <DialogOverlay />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dialog title</DialogTitle>
                <DialogDescription>Dialog description</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose>Close dialog</DialogClose>
              </DialogFooter>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      </>,
    );

    expect(screen.getAllByTestId("alert-overlay")[0].className).toContain("bg-black/80");
    expect(screen.getByTestId("alert-content").className).toContain("max-w-lg");
    expect(screen.getByTestId("alert-action").className).toContain("bg-primary");
    expect(screen.getByTestId("alert-cancel").className).toContain("border");
    expect(screen.getAllByTestId("dialog-overlay")[0].className).toContain("bg-black/80");
    expect(screen.getAllByTestId("dialog-content")[0].textContent).toContain("Dialog title");
    expect(screen.getAllByText("Close").length).toBeGreaterThan(0);
  });

  it("renders checkbox, scroll area, and tabs wrappers", () => {
    render(
      <>
        <Checkbox checked />
        <ScrollArea>
          <div>Scrollable</div>
        </ScrollArea>
        <ScrollBar orientation="horizontal" />
        <Tabs value="one">
          <TabsList>
            <TabsTrigger value="one">One</TabsTrigger>
          </TabsList>
          <TabsContent value="one">Panel</TabsContent>
        </Tabs>
      </>,
    );

    expect(screen.getByTestId("checkbox-root").className).toContain("peer");
    expect(screen.getByTestId("checkbox-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("scroll-root").className).toContain("overflow-hidden");
    expect(screen.getByTestId("scrollbar-horizontal").className).toContain("flex-col");
    expect(screen.getByTestId("tabs-list").className).toContain("rounded-xl");
    expect(screen.getByTestId("tabs-trigger-one").className).toContain("rounded-lg");
    expect(screen.getByTestId("tabs-content-one").className).toContain("mt-6");
  });

  it("renders select wrappers", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue>Selected</SelectValue>
        </SelectTrigger>
        <SelectContent position="item-aligned">
          <SelectGroup>
            <SelectLabel>Group</SelectLabel>
            <SelectItem value="a">Alpha</SelectItem>
          </SelectGroup>
          <SelectSeparator />
        </SelectContent>
      </Select>,
    );

    expect(screen.getByTestId("select-trigger").className).toContain("justify-between");
    expect(screen.getByTestId("select-content")).toHaveAttribute("data-position", "item-aligned");
    expect(screen.getAllByTestId("select-scroll-up")).toHaveLength(1);
    expect(screen.getAllByTestId("select-scroll-down")).toHaveLength(1);
    expect(screen.getAllByTestId("icon-chevron-up").length).toBeGreaterThan(0);
    expect(screen.getByTestId("select-item").className).toContain("pl-8");
    expect(screen.getByTestId("select-separator").className).toContain("bg-muted");
  });

  it("renders default popper select positioning classes", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue>Selected</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="b">Beta</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByTestId("select-content").className).toContain("translate-y-1");
    expect(screen.getByTestId("select-viewport").className).toContain("min-w-[var(--radix-select-trigger-width)]");
  });

  it("renders sheet, tooltip, toggle group, and toast wrappers", () => {
    render(
      <>
        <Sheet>
          <SheetTrigger>Open sheet</SheetTrigger>
          <SheetPortal>
            <SheetOverlay />
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Sheet title</SheetTitle>
                <SheetDescription>Sheet description</SheetDescription>
              </SheetHeader>
              <SheetFooter>
                <SheetClose>Close sheet</SheetClose>
              </SheetFooter>
            </SheetContent>
          </SheetPortal>
        </Sheet>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Hover</TooltipTrigger>
            <TooltipContent sideOffset={8}>Tip</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <ToggleGroup type="single" value="a" variant="default" size="sm">
          <ToggleGroupItem value="a">A</ToggleGroupItem>
        </ToggleGroup>
        <ToastProvider>
          <Toast variant="destructive">
            <ToastTitle>Toast title</ToastTitle>
            <ToastDescription>Toast description</ToastDescription>
            <ToastAction altText="Act">Act</ToastAction>
            <ToastClose />
          </Toast>
          <ToastViewport />
        </ToastProvider>
      </>,
    );

    expect(screen.getAllByTestId("dialog-overlay")[0].className).toContain("bg-black/80");
    expect(screen.getAllByTestId("dialog-content")[0].className).toContain("inset-y-0 left-0");
    expect(screen.getByTestId("tooltip-content")).toHaveAttribute("data-side-offset", "8");
    expect(screen.getByTestId("toggle-item-a").className).toContain("h-9 px-2.5");
    expect(screen.getByTestId("toast-root").className).toContain("bg-destructive");
    expect(screen.getByTestId("toast-close")).toHaveAttribute("toast-close");
    expect(screen.getByTestId("toast-viewport").className).toContain("max-h-screen");
  });

  it("renders toaster and sonner wrappers", () => {
    render(
      <>
        <Toaster />
        <SonnerToaster richColors />
      </>,
    );

    expect(screen.getAllByTestId("toast-root")).toHaveLength(2);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
    expect(screen.getByTestId("sonner-toaster")).toHaveAttribute("data-theme", "system");
    expect(sonnerToast).toBeDefined();
  });
});
