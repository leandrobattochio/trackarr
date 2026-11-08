import { fireEvent, render, screen } from "@testing-library/react";
import { ProxiesTab } from "@/features/proxies/components/ProxiesTab";
import type { ApiProxy } from "@/features/proxies/types";
import { ApiError } from "@/shared/api/http";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args), error: (...args: unknown[]) => toastError(...args) },
}));

vi.mock("@/features/proxies/components/ProxyDialog", () => ({
  ProxyDialog: ({ open, proxy }: { open: boolean; proxy: ApiProxy | null }) =>
    open ? <div data-testid="proxy-dialog">{proxy ? `editing ${proxy.name}` : "adding"}</div> : null,
}));

const proxies: ApiProxy[] = [
  { id: "proxy-1", name: "Home VPN", type: "socks5", host: "10.0.0.2", port: 1080, username: null, hasPassword: false },
  { id: "proxy-2", name: "Office", type: "http", host: "10.0.0.3", port: 3128, username: "alice", hasPassword: true },
];
const query = { data: proxies as ApiProxy[] | undefined, isLoading: false, error: null as Error | null };
const remove = { mutate: vi.fn() };
vi.mock("@/features/proxies/hooks", () => ({
  useProxies: () => query,
  useDeleteProxy: () => remove,
}));

function confirmDelete(name: string) {
  fireEvent.click(screen.getByRole("button", { name: `Delete ${name}` }));
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
}

describe("ProxiesTab", () => {
  beforeEach(() => {
    query.data = proxies;
    query.isLoading = false;
    query.error = null;
    remove.mutate.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("lists the proxies with their type, address and login", () => {
    render(<ProxiesTab />);

    const rows = screen.getAllByTestId("proxy-row");
    expect(rows.map((row) => row.getAttribute("data-proxy-name"))).toEqual(["Home VPN", "Office"]);
    expect(rows[0]).toHaveTextContent("SOCKS5");
    expect(rows[0]).toHaveTextContent("10.0.0.2:1080 · no login");
    expect(rows[1]).toHaveTextContent("HTTP");
    expect(rows[1]).toHaveTextContent("10.0.0.3:3128 · user alice");
  });

  it("shows the empty, loading and error states", () => {
    query.data = [];
    const { rerender } = render(<ProxiesTab />);
    expect(screen.getByText("No proxies yet.")).toBeInTheDocument();

    query.data = undefined;
    query.isLoading = true;
    rerender(<ProxiesTab />);
    expect(screen.queryByText("No proxies yet.")).not.toBeInTheDocument();

    query.isLoading = false;
    query.error = new Error("api down");
    rerender(<ProxiesTab />);
    expect(screen.getByText("Failed to load proxies: api down")).toBeInTheDocument();
  });

  it("opens the dialog to add a proxy or edit one", () => {
    render(<ProxiesTab />);

    fireEvent.click(screen.getByTestId("add-proxy"));
    expect(screen.getByTestId("proxy-dialog")).toHaveTextContent("adding");

    fireEvent.click(screen.getByRole("button", { name: "Edit Office" }));
    expect(screen.getByTestId("proxy-dialog")).toHaveTextContent("editing Office");
  });

  it("deletes a proxy after confirming", () => {
    remove.mutate.mockImplementation((_id, options) => options.onSuccess());
    render(<ProxiesTab />);

    confirmDelete("Home VPN");

    expect(remove.mutate).toHaveBeenCalledWith("proxy-1", expect.anything());
    expect(toastSuccess).toHaveBeenCalledWith("Proxy Home VPN deleted");
  });

  it("names the integrations that still use a proxy it cannot delete", () => {
    remove.mutate.mockImplementationOnce((_id, options) => options.onError(new ApiError("in use", 409, {
      error: "Proxy 'Office' is used by 1 integration(s).",
      integrations: [{ id: "int-1", name: "Seedpool" }],
    })));
    remove.mutate.mockImplementationOnce((_id, options) => options.onError(new Error("network down")));
    render(<ProxiesTab />);

    confirmDelete("Office");
    expect(toastError).toHaveBeenCalledWith("Proxy 'Office' is used by 1 integration(s). Used by: Seedpool.");

    confirmDelete("Office");
    expect(toastError).toHaveBeenCalledWith("Delete failed: network down");
  });
});
