import { initialForm, toDto, validateProxyForm, type ProxyForm } from "@/features/proxies/proxy-form";

const valid: ProxyForm = {
  name: " vpn ",
  type: "socks5",
  host: " 10.0.0.2 ",
  port: "1080",
  username: " alice ",
  password: "",
  passwordChanged: false,
};

describe("proxy form", () => {
  it("starts empty as an HTTP proxy on 8080, or from the proxy being edited", () => {
    expect(initialForm(null)).toEqual({
      name: "", type: "http", host: "", port: "8080", username: "", password: "", passwordChanged: false,
    });
    expect(initialForm({ id: "p", name: "vpn", type: "socks5", host: "h", port: 1080, username: null, hasPassword: true }))
      .toMatchObject({ name: "vpn", type: "socks5", host: "h", port: "1080", username: "", password: "" });
  });

  it.each([
    [{ name: " " }, "Name is required."],
    [{ host: "" }, "Host is required."],
    [{ host: "http://10.0.0.2" }, "Host must be a host name or an IP address, with no scheme or path."],
    [{ host: "10.0.0.2/path" }, "Host must be a host name or an IP address, with no scheme or path."],
    [{ port: "0" }, "Port must be between 1 and 65535."],
    [{ port: "65536" }, "Port must be between 1 and 65535."],
    [{ port: "12.5" }, "Port must be between 1 and 65535."],
    [{ port: "abc" }, "Port must be between 1 and 65535."],
  ])("rejects %o", (changes, message) => {
    expect(validateProxyForm({ ...valid, ...changes })).toBe(message);
  });

  it("accepts a valid proxy", () => {
    expect(validateProxyForm(valid)).toBeNull();
  });

  it("trims the values and sends a password only when it was typed", () => {
    expect(toDto(valid)).toEqual({ name: "vpn", type: "socks5", host: "10.0.0.2", port: 1080, username: "alice", password: null });
    expect(toDto({ ...valid, password: "secret", passwordChanged: true }).password).toBe("secret");
    expect(toDto({ ...valid, password: "", passwordChanged: true }).password).toBe("");
    expect(toDto({ ...valid, username: "  " }).username).toBeNull();
  });
});
