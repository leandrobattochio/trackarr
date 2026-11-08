import { describe, expect, it } from "vitest";
import { formatBytes, formatDateTime } from "@/shared/lib/formatters";

describe("formatBytes", () => {
  it("formats zero bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats binary byte sizes", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats decimal byte sizes", () => {
    expect(formatBytes(1000, "decimal")).toBe("1 KB");
    expect(formatBytes(1500, "decimal")).toBe("1.5 KB");
  });
});

describe("formatDateTime", () => {
  it("formats an ISO time in the local format and keeps invalid input", () => {
    const value = "2026-11-07T12:00:05+00:00";
    expect(formatDateTime(value)).toBe(new Date(value).toLocaleString());
    expect(formatDateTime("not a date")).toBe("not a date");
  });
});
