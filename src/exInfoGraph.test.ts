import { describe, expect, it, beforeEach } from "vitest";
import {
  EX_INFO_GRAPH_KEY,
  defaultExInfoBubble,
  loadExInfoBubble,
  patchExInfoBubble,
  cycleExInfoBubbleType,
} from "./exInfoGraph";

/** In-memory localStorage stand-in (node test env has none). */
function installFakeStorage(): void {
  const map = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => map.set(k, v),
    removeItem: (k: string) => map.delete(k),
    clear: () => map.clear(),
  };
}

beforeEach(() => {
  installFakeStorage();
  localStorage.removeItem(EX_INFO_GRAPH_KEY);
});

describe("exInfoGraph", () => {
  it("defaults to rvw single-lift scatter", () => {
    const b = defaultExInfoBubble("Hip Thrust");
    expect(b.type).toBe("rvw");
    expect(b.exercises).toEqual(["Hip Thrust"]);
    expect(b.metrics).toContain("e1rm");
  });

  it("persists patches per exercise", () => {
    patchExInfoBubble("Hip Thrust", { type: "time", metrics: ["volume", "e1rm"] });
    const loaded = loadExInfoBubble("Hip Thrust");
    expect(loaded.type).toBe("time");
    expect(loaded.metrics).toEqual(["volume", "e1rm"]);
    expect(loadExInfoBubble("Push Ups").type).toBe("rvw");
  });

  it("cycles graph type", () => {
    expect(loadExInfoBubble("Squat").type).toBe("rvw");
    cycleExInfoBubbleType("Squat");
    expect(loadExInfoBubble("Squat").type).toBe("time");
    cycleExInfoBubbleType("Squat");
    expect(loadExInfoBubble("Squat").type).toBe("rvw");
  });
});
