import { fireEvent, render, screen } from "@testing-library/react";
import { ProxySelect } from "@/features/proxies/components/ProxySelect";

vi.mock("@/components/ui/select", () => import("@/test/select-mock"));

vi.mock("@/features/proxies/hooks", () => ({
  useProxies: () => ({
    data: [{ id: "proxy-1", name: "Home VPN", type: "socks5", host: "10.0.0.2", port: 1080, username: null, hasPassword: false }],
  }),
}));

describe("ProxySelect", () => {
  it("offers no proxy and every saved proxy", () => {
    render(<ProxySelect value={null} onChange={vi.fn()} />);

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["No proxy", "Home VPN"]);
    expect(screen.getByTestId("select-value")).toHaveTextContent("none");
  });

  it("reports the picked proxy, or null for no proxy", () => {
    const onChange = vi.fn();
    render(<ProxySelect value="proxy-1" onChange={onChange} />);

    fireEvent.click(screen.getByRole("option", { name: "No proxy" }));
    fireEvent.click(screen.getByRole("option", { name: "Home VPN" }));

    expect(onChange).toHaveBeenNthCalledWith(1, null);
    expect(onChange).toHaveBeenNthCalledWith(2, "proxy-1");
  });
});
