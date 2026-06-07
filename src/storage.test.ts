import { describe, it, expect, beforeEach } from "vitest";
import { loadJsonObject, saveJson } from "./storage";

/** A tiny in-memory localStorage stand-in (the node test env has none). */
function installFakeStorage(): { throwOnSet?: boolean } {
  const flags: { throwOnSet?: boolean } = {};
  const map = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      if (flags.throwOnSet) throw new Error("quota");
      map.set(k, v);
    },
    removeItem: (k: string) => map.delete(k),
    clear: () => map.clear(),
  };
  return flags;
}

beforeEach(() => { installFakeStorage(); });

describe("loadJsonObject", () => {
  it("round-trips an object written by saveJson", () => {
    saveJson("k", { a: 1, b: "x" });
    expect(loadJsonObject("k")).toEqual({ a: 1, b: "x" });
  });
  it("returns {} for a missing key", () => {
    expect(loadJsonObject("absent")).toEqual({});
  });
  it("returns {} for invalid JSON", () => {
    localStorage.setItem("bad", "{not json");
    expect(loadJsonObject("bad")).toEqual({});
  });
  it("returns {} for a non-object JSON value", () => {
    localStorage.setItem("arrnull", "null");
    expect(loadJsonObject("arrnull")).toEqual({});
    localStorage.setItem("num", "42");
    expect(loadJsonObject("num")).toEqual({});
  });
});

describe("saveJson", () => {
  it("stores a JSON string", () => {
    saveJson("k", [1, 2, 3]);
    expect(localStorage.getItem("k")).toBe("[1,2,3]");
  });
  it("never throws when storage is unavailable", () => {
    const flags = installFakeStorage();
    flags.throwOnSet = true;
    expect(() => saveJson("k", { a: 1 })).not.toThrow();
  });
});
