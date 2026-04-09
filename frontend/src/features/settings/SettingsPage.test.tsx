import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const toastSuccess = vi.fn();
const toastError = vi.fn();
const pageTitleSpy = vi.fn();
const mutateSpy = vi.fn();

const settingsQuery = {
  data: undefined as { userAgent: string; checkForUpdates: boolean; checkForUpdatesOverridden: boolean } | undefined,
  isLoading: false,
  error: null as Error | null,
};

const aboutQuery = {
  data: undefined as unknown,
  isLoading: false,
  error: null as Error | null,
};

const updateMutation = {
  mutate: (...args: unknown[]) => mutateSpy(...args),
  isPending: false,
};

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock("@/layouts/DashboardLayout", () => ({
  DashboardLayout: ({ children }: unknown) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: unknown) => <div>{children}</div>,
  TabsList: ({ children }: unknown) => <div>{children}</div>,
  TabsTrigger: ({ children }: unknown) => <button type="button">{children}</button>,
  TabsContent: ({ children }: unknown) => <div>{children}</div>,
}));

vi.mock("@/shared/hooks/use-page-title", () => ({
  usePageTitle: (...args: unknown[]) => pageTitleSpy(...args),
}));

vi.mock("@/features/settings/hooks", () => ({
  useSettings: () => settingsQuery,
  useAboutInfo: () => aboutQuery,
  useUpdateSettings: () => updateMutation,
}));

vi.mock("@/features/settings/components", () => ({
  HttpSettingsTab: (props: unknown) => (
    <div data-testid="http-tab">
      <span>{`dirty:${String(props.isDirty)}`}</span>
      <span>{`busy:${String(props.isBusy)}`}</span>
      <span>{`loading:${String(props.isLoading)}`}</span>
      <span>{`error:${props.error?.message ?? "none"}`}</span>
      <span>{`ua:${props.userAgent}`}</span>
      <span>{`check:${String(props.checkForUpdates)}`}</span>
      <span>{`overridden:${String(props.checkForUpdatesOverridden)}`}</span>
      <span>{`validation:${props.validationError ?? "none"}`}</span>
      <button type="button" onClick={() => props.onChangeUserAgent("   ")}>set-empty</button>
      <button type="button" onClick={() => props.onChangeUserAgent("TrackArr/2.0")}>set-valid</button>
      <button type="button" onClick={() => props.onChangeCheckForUpdates(!props.checkForUpdates)}>toggle-updates</button>
      <button type="button" onClick={props.onSave}>save-settings</button>
    </div>
  ),
  AboutTab: (props: unknown) => (
    <div data-testid="about-tab">
      <span>{`about-loading:${String(props.isLoading)}`}</span>
      <span>{`about-error:${props.error?.message ?? "none"}`}</span>
      <span>{`about-version:${props.aboutInfo?.version ?? "none"}`}</span>
    </div>
  ),
}));

import SettingsPage from "@/features/settings/SettingsPage";

describe("SettingsPage", () => {
  it("renders with query props, validates empty save, and clears validation on change", () => {
    settingsQuery.data = undefined;
    settingsQuery.isLoading = true;
    settingsQuery.error = new Error("load failed");
    aboutQuery.data = undefined;
    aboutQuery.isLoading = true;
    aboutQuery.error = new Error("about failed");
    updateMutation.isPending = true;
    mutateSpy.mockReset();

    render(<SettingsPage />);

    expect(pageTitleSpy).toHaveBeenCalledWith("TrackArr | Settings");
    expect(screen.getByText("dirty:false")).toBeInTheDocument();
    expect(screen.getByText("busy:true")).toBeInTheDocument();
    expect(screen.getByText("loading:true")).toBeInTheDocument();
    expect(screen.getByText("error:load failed")).toBeInTheDocument();
    expect(screen.getByText("about-loading:true")).toBeInTheDocument();
    expect(screen.getByText("about-error:about failed")).toBeInTheDocument();
    expect(screen.getByText("about-version:none")).toBeInTheDocument();

    fireEvent.click(screen.getByText("set-empty"));
    fireEvent.click(screen.getByText("save-settings"));
    expect(screen.getByText("validation:User-Agent must not be empty.")).toBeInTheDocument();
    expect(mutateSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("set-valid"));
    expect(screen.getByText("validation:none")).toBeInTheDocument();
  });

  it("saves successfully and handles mutation errors", () => {
    settingsQuery.data = {
      userAgent: "TrackArr/1.0",
      checkForUpdates: true,
      checkForUpdatesOverridden: false,
    };
    settingsQuery.isLoading = false;
    settingsQuery.error = null;
    aboutQuery.data = { version: "1.0.0" };
    aboutQuery.isLoading = false;
    aboutQuery.error = null;
    updateMutation.isPending = false;
    mutateSpy.mockReset();

    mutateSpy
      .mockImplementationOnce((_value: unknown, options: unknown) => options.onSuccess({
        userAgent: "TrackArr/2.0",
        checkForUpdates: false,
        checkForUpdatesOverridden: true,
      }))
      .mockImplementationOnce((_value: unknown, options: unknown) => options.onError(new Error("write failed")));

    render(<SettingsPage />);

    expect(screen.getByText("ua:TrackArr/1.0")).toBeInTheDocument();
    expect(screen.getByText("check:true")).toBeInTheDocument();
    expect(screen.getByText("overridden:false")).toBeInTheDocument();
    expect(screen.getByText("dirty:false")).toBeInTheDocument();
    expect(screen.getByText("about-version:1.0.0")).toBeInTheDocument();

    fireEvent.click(screen.getByText("set-valid"));
    fireEvent.click(screen.getByText("toggle-updates"));
    expect(screen.getByText("dirty:true")).toBeInTheDocument();
    fireEvent.click(screen.getByText("save-settings"));

    expect(mutateSpy).toHaveBeenCalledWith(
      { userAgent: "TrackArr/2.0", checkForUpdates: false },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith("Settings saved.");
    expect(screen.getByText("ua:TrackArr/2.0")).toBeInTheDocument();
    expect(screen.getByText("check:false")).toBeInTheDocument();
    expect(screen.getByText("overridden:true")).toBeInTheDocument();
    expect(screen.getByText("dirty:false")).toBeInTheDocument();

    fireEvent.click(screen.getByText("set-valid"));
    fireEvent.click(screen.getByText("save-settings"));
    expect(toastError).toHaveBeenCalledWith("Save failed: write failed");
  });
});


