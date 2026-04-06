import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => ({
  Loader2: () => <svg data-testid="icon-loader" />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button type="button" onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, disabled, children }: any) => (
    <div>
      <button type="button" disabled={disabled} onClick={() => onValueChange("integration-2")}>
        select-value:{value}
      </button>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-testid={`select-item-${value}`}>{children}</div>,
}));

vi.mock("@/components/ui/toggle-group", () => ({
  ToggleGroup: ({ children, onValueChange }: any) => (
    <div>
      <button type="button" onClick={() => onValueChange("")}>toggle-empty</button>
      <button type="button" onClick={() => onValueChange("custom")}>toggle-custom</button>
      {children}
    </div>
  ),
  ToggleGroupItem: ({ children, value }: any) => <button type="button" data-testid={`range-${value}`}>{children}</button>,
}));

vi.mock("@/features/snapshots/range", () => ({
  snapshotRangeOptions: [
    { key: "7d", label: "7d" },
    { key: "30d", label: "30d" },
    { key: "custom", label: "Custom" },
  ],
}));

import { SnapshotFiltersCard } from "@/features/snapshots/components/SnapshotFiltersCard";

describe("SnapshotFiltersCard", () => {
  it("renders integration/range controls and custom apply state", () => {
    const onIntegrationChange = vi.fn();
    const onRangeChange = vi.fn();
    const onFromChange = vi.fn();
    const onToChange = vi.fn();
    const onApply = vi.fn();
    const onReset = vi.fn();

    const { rerender } = render(
      <SnapshotFiltersCard
        integrationId="integration-1"
        range="custom"
        from="2026-01-01T10:00"
        to="2026-01-02T10:00"
        integrations={[
          { id: "integration-1", name: "Tracker A", username: "userA" },
          { id: "integration-2", name: "Tracker B", username: null },
        ]}
        integrationsLoading={false}
        pluginsLoading={false}
        isBusy={true}
        activeFilterAction="apply"
        onIntegrationChange={onIntegrationChange}
        onRangeChange={onRangeChange}
        onFromChange={onFromChange}
        onToChange={onToChange}
        onApply={onApply}
        onReset={onReset}
      />,
    );

    expect(screen.getByText("Tracker A - userA")).toBeInTheDocument();
    expect(screen.getByText("Tracker B")).toBeInTheDocument();

    fireEvent.click(screen.getByText("select-value:integration-1"));
    expect(onIntegrationChange).toHaveBeenCalledWith("integration-2");

    fireEvent.click(screen.getByText("toggle-empty"));
    expect(onRangeChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("toggle-custom"));
    expect(onRangeChange).toHaveBeenCalledWith("custom");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01T00:00" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-01-03T00:00" } });
    expect(onFromChange).toHaveBeenCalledWith("2026-01-01T00:00");
    expect(onToChange).toHaveBeenCalledWith("2026-01-03T00:00");

    const applyButton = screen.getByRole("button", { name: /Apply/i });
    expect(applyButton).toBeDisabled();
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();

    rerender(
      <SnapshotFiltersCard
        integrationId="integration-1"
        range="custom"
        from="2026-01-01T10:00"
        to="2026-01-02T10:00"
        integrations={[
          { id: "integration-1", name: "Tracker A", username: "userA" },
          { id: "integration-2", name: "Tracker B", username: null },
        ]}
        integrationsLoading={false}
        pluginsLoading={false}
        isBusy={false}
        activeFilterAction={null}
        onIntegrationChange={onIntegrationChange}
        onRangeChange={onRangeChange}
        onFromChange={onFromChange}
        onToChange={onToChange}
        onApply={onApply}
        onReset={onReset}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Reset/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("hides custom fields when range is not custom and handles reset spinner state", () => {
    const onApply = vi.fn();
    const onReset = vi.fn();

    render(
      <SnapshotFiltersCard
        integrationId=""
        range="7d"
        from=""
        to=""
        integrations={[]}
        integrationsLoading={true}
        pluginsLoading={false}
        isBusy={true}
        activeFilterAction="reset"
        onIntegrationChange={vi.fn()}
        onRangeChange={vi.fn()}
        onFromChange={vi.fn()}
        onToChange={vi.fn()}
        onApply={onApply}
        onReset={onReset}
      />,
    );

    expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apply/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /select-value:/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Reset/i })).toBeDisabled();
  });
});
