import { describe, expect, it, vi } from "vitest";

const routerNavLinkSpy = vi.fn();

vi.mock("react-router-dom", () => ({
  NavLink: ({ className }: { className: ({ isActive, isPending }: { isActive: boolean; isPending: boolean }) => string }) => {
    routerNavLinkSpy(className({ isActive: true, isPending: false }));
    routerNavLinkSpy(className({ isActive: false, isPending: true }));
    routerNavLinkSpy(className({ isActive: false, isPending: false }));
    return null;
  },
}));

import { render } from "@testing-library/react";
import { NavLink } from "@/layouts/NavLink";

describe("NavLink", () => {
  it("applies base, active, and pending classes", () => {
    routerNavLinkSpy.mockReset();

    render(
      <NavLink to="/settings" className="base" activeClassName="active" pendingClassName="pending">
        Settings
      </NavLink>,
    );

    expect(routerNavLinkSpy).toHaveBeenNthCalledWith(1, expect.stringContaining("base"));
    expect(routerNavLinkSpy).toHaveBeenNthCalledWith(1, expect.stringContaining("active"));
    expect(routerNavLinkSpy).toHaveBeenNthCalledWith(2, expect.stringContaining("base"));
    expect(routerNavLinkSpy).toHaveBeenNthCalledWith(2, expect.stringContaining("pending"));
    expect(routerNavLinkSpy).toHaveBeenNthCalledWith(3, "base");
  });
});
