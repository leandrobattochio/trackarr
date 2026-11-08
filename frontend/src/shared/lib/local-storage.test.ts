import { afterEach, describe, expect, it, vi } from "vitest";
import { readLocalStorage, writeLocalStorage } from "@/shared/lib/local-storage";

const KEY = "trackarr.test.key";
const parseString = (value: unknown) => (typeof value === "string" ? value : undefined);

describe("local storage helpers", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("reads back what was written", () => {
    writeLocalStorage(KEY, "list");

    expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify("list"));
    expect(readLocalStorage(KEY, parseString)).toBe("list");
  });

  it("returns undefined for a missing key", () => {
    expect(readLocalStorage(KEY, parseString)).toBeUndefined();
  });

  it("returns undefined when the stored value is not JSON", () => {
    window.localStorage.setItem(KEY, "{broken");

    expect(readLocalStorage(KEY, parseString)).toBeUndefined();
  });

  it("returns what the parser returns for a value of the wrong shape", () => {
    window.localStorage.setItem(KEY, JSON.stringify(42));

    expect(readLocalStorage(KEY, parseString)).toBeUndefined();
  });

  it("returns undefined when storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(readLocalStorage(KEY, parseString)).toBeUndefined();
  });

  it("warns instead of throwing when storage cannot be written", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    expect(() => writeLocalStorage(KEY, "list")).not.toThrow();
    expect(warn).toHaveBeenCalledWith(`Failed to persist ${KEY} to localStorage.`, expect.any(Error));
  });
});
