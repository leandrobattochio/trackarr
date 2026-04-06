import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => ({
  Loader2: () => <svg data-testid="icon-loader" />,
  Save: () => <svg data-testid="icon-save" />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button type="button" onClick={onClick} disabled={disabled}>
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
  Input: ({ onChange, ...props }: any) => <input onChange={onChange} {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
}));

import { HttpSettingsTab } from "@/features/settings/components/HttpSettingsTab";

describe("HttpSettingsTab", () => {
  it("renders loading and error states", () => {
    const { rerender } = render(
      <HttpSettingsTab
        isDirty={false}
        isBusy={false}
        isLoading
        error={null}
        userAgent=""
        validationError={null}
        onChangeUserAgent={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();

    rerender(
      <HttpSettingsTab
        isDirty={false}
        isBusy={false}
        isLoading={false}
        error={new Error("settings failed")}
        userAgent=""
        validationError={null}
        onChangeUserAgent={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("Failed to load settings: settings failed")).toBeInTheDocument();
  });

  it("renders form, validates interactions, and toggles busy/save visuals", () => {
    const onChangeUserAgent = vi.fn();
    const onSave = vi.fn();

    const { rerender } = render(
      <HttpSettingsTab
        isDirty
        isBusy={false}
        isLoading={false}
        error={null}
        userAgent="TrackArr/1.0"
        validationError="User-Agent must not be empty."
        onChangeUserAgent={onChangeUserAgent}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText("User-Agent"), { target: { value: "TrackArr/2.0" } });
    expect(onChangeUserAgent).toHaveBeenCalledWith("TrackArr/2.0");

    fireEvent.click(screen.getByRole("button", { name: /Save/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByText("User-Agent must not be empty.")).toBeInTheDocument();
    expect(screen.getByTestId("icon-save")).toBeInTheDocument();

    rerender(
      <HttpSettingsTab
        isDirty={false}
        isBusy
        isLoading={false}
        error={null}
        userAgent="TrackArr/2.0"
        validationError={null}
        onChangeUserAgent={onChangeUserAgent}
        onSave={onSave}
      />,
    );

    expect(screen.getByLabelText("User-Agent")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Save/i })).toBeDisabled();
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();
  });
});
