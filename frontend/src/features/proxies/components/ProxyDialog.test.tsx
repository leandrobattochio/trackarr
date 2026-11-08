import { fireEvent, render, screen } from "@testing-library/react";
import { ProxyDialog } from "@/features/proxies/components/ProxyDialog";
import type { ApiProxy } from "@/features/proxies/types";

vi.mock("@/components/ui/select", () => import("@/test/select-mock"));

const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => toastSuccess(...args) } }));

const save = { mutate: vi.fn(), isPending: false };
const test = { mutate: vi.fn(), isPending: false };
vi.mock("@/features/proxies/hooks", () => ({
  useSaveProxy: () => save,
  useTestProxy: () => test,
}));

const saved: ApiProxy = { id: "proxy-1", name: "Office", type: "http", host: "10.0.0.3", port: 3128, username: "alice", hasPassword: true };

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Save proxy" }));
}

describe("ProxyDialog", () => {
  beforeEach(() => {
    save.mutate.mockReset();
    test.mutate.mockReset();
    toastSuccess.mockReset();
  });

  it("validates before saving a new proxy", () => {
    render(<ProxyDialog open proxy={null} onOpenChange={vi.fn()} />);

    submit();

    expect(screen.getByRole("alert")).toHaveTextContent("Name is required.");
    expect(save.mutate).not.toHaveBeenCalled();
  });

  it("saves a new proxy, switching the default port with the type", () => {
    const onOpenChange = vi.fn();
    save.mutate.mockImplementation((_input, options) => options.onSuccess({ ...saved, name: "Home VPN" }));
    render(<ProxyDialog open proxy={null} onOpenChange={onOpenChange} />);

    expect(screen.getByRole("heading", { name: "Add proxy" })).toBeInTheDocument();
    expect(screen.getByLabelText("Port")).toHaveValue("8080");
    fireEvent.click(screen.getByRole("option", { name: "SOCKS5" }));
    expect(screen.getByLabelText("Port")).toHaveValue("1080");
    fill("Name", "Home VPN");
    fill("Host", "10.0.0.2");
    expect(screen.getByLabelText("Password (optional)")).toBeDisabled();
    fill("Username (optional)", "bob");
    fill("Password (optional)", "secret");
    submit();

    expect(save.mutate).toHaveBeenCalledWith(
      { id: null, dto: { name: "Home VPN", type: "socks5", host: "10.0.0.2", port: 1080, username: "bob", password: "secret" } },
      expect.anything(),
    );
    expect(toastSuccess).toHaveBeenCalledWith("Proxy Home VPN saved");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps a typed port when the type changes", () => {
    render(<ProxyDialog open proxy={null} onOpenChange={vi.fn()} />);

    fill("Port", "9050");
    fireEvent.click(screen.getByRole("option", { name: "SOCKS4" }));

    expect(screen.getByLabelText("Port")).toHaveValue("9050");
    expect(screen.getByText(/SOCKS4 resolves the tracker's host name on this machine/)).toBeInTheDocument();
  });

  it("edits a saved proxy without resending its password", () => {
    render(<ProxyDialog open proxy={saved} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Edit Office" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password (optional)")).toHaveAttribute("placeholder", "Saved password unchanged");
    fill("Port", "3129");
    submit();

    expect(save.mutate).toHaveBeenCalledWith(
      { id: "proxy-1", dto: { name: "Office", type: "http", host: "10.0.0.3", port: 3129, username: "alice", password: null } },
      expect.anything(),
    );
  });

  it("shows why a save failed", () => {
    save.mutate.mockImplementation((_input, options) => options.onError(new Error("A proxy named 'Office' already exists.")));
    render(<ProxyDialog open proxy={saved} onOpenChange={vi.fn()} />);

    submit();

    expect(screen.getByRole("alert")).toHaveTextContent("A proxy named 'Office' already exists.");
  });

  it("tests the proxy in the form and shows the result", () => {
    test.mutate.mockImplementationOnce((_input, options) =>
      options.onSuccess({ success: true, testUrl: "https://github.com/", statusCode: 200, error: null }));
    test.mutate.mockImplementationOnce((_input, options) =>
      options.onSuccess({ success: false, testUrl: "https://github.com/", statusCode: null, error: "Connection refused." }));
    test.mutate.mockImplementationOnce((_input, options) => options.onError(new Error("Proxy not found")));
    render(<ProxyDialog open proxy={saved} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Test" }));
    expect(test.mutate).toHaveBeenCalledWith(
      { id: "proxy-1", dto: expect.objectContaining({ host: "10.0.0.3", password: null }) },
      expect.anything(),
    );
    expect(screen.getByTestId("proxy-test-result")).toHaveTextContent(
      "Connected: https://github.com/ answered HTTP 200 through the proxy.");

    fireEvent.click(screen.getByRole("button", { name: "Test" }));
    expect(screen.getByTestId("proxy-test-result")).toHaveTextContent(
      "Could not reach https://github.com/ through the proxy. Connection refused.");

    fireEvent.click(screen.getByRole("button", { name: "Test" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Proxy not found");
  });

  it("does not test an invalid proxy", () => {
    render(<ProxyDialog open proxy={null} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Test" }));

    expect(test.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Name is required.");
  });
});
