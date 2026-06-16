import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  defaultLayout,
  lockedDefaultLayout,
  loadLayout,
  saveLayout,
  flushSaveLayout,
  switchTab,
  getActiveTab,
} from "./graphLayout";

describe("graphLayout", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("defaultLayout", () => {
    it("returns a valid layout with one tab", () => {
      const layout = defaultLayout();
      expect(layout.tabs).toHaveLength(1);
      expect(layout.tabs[0]?.id).toBe("tab-main");
    });

    it("default layout has one carousel with one graph", () => {
      const layout = defaultLayout();
      expect(layout.tabs[0]?.carousels).toHaveLength(1);
      expect(layout.tabs[0]?.carousels[0]?.graphs).toHaveLength(1);
    });

    it("default graph is weight-time single-view of Squat", () => {
      const layout = defaultLayout();
      const graph = layout.tabs[0]?.carousels[0]?.graphs[0];
      expect(graph?.exerciseName).toBe("Squat");
      expect(graph?.type).toBe("weight-time");
      expect(graph?.viewMode).toBe("single");
    });

    it("active tab matches the only tab", () => {
      const layout = defaultLayout();
      expect(layout.activeTabId).toBe("tab-main");
    });
  });

  describe("lockedDefaultLayout", () => {
    it("returns the same structure as defaultLayout", () => {
      const locked = lockedDefaultLayout();
      const def = defaultLayout();
      expect(locked).toEqual(def);
    });
  });

  describe("loadLayout", () => {
    it("returns default layout when nothing is saved", () => {
      const loaded = loadLayout();
      expect(loaded).toEqual(defaultLayout());
    });

    it("loads a saved layout from localStorage", () => {
      const custom = defaultLayout();
      if (custom.tabs[0]) custom.tabs[0].name = "Custom Tab";
      localStorage.setItem("colosseum.graphLayout.v1", JSON.stringify(custom));

      const loaded = loadLayout();
      expect(loaded.tabs[0]?.name).toBe("Custom Tab");
    });

    it("falls back to default if JSON is invalid", () => {
      localStorage.setItem("colosseum.graphLayout.v1", "not valid json");
      const loaded = loadLayout();
      expect(loaded).toEqual(defaultLayout());
    });

    it("falls back to default if schema validation fails", () => {
      const invalid = { tabs: "not an array", activeTabId: "missing" }; // wrong type
      localStorage.setItem("colosseum.graphLayout.v1", JSON.stringify(invalid));
      const loaded = loadLayout();
      expect(loaded).toEqual(defaultLayout());
    });

    it("round-trip: load after save returns the same layout", () => {
      const original = defaultLayout();
      original.tabs[0]!.name = "Test Tab";
      original.tabs[0]!.carousels[0]!.graphs[0]!.exerciseName = "Bench Press";

      localStorage.setItem("colosseum.graphLayout.v1", JSON.stringify(original));
      const loaded = loadLayout();

      expect(loaded).toEqual(original);
      expect(loaded.tabs[0]?.name).toBe("Test Tab");
      expect(loaded.tabs[0]?.carousels[0]?.graphs[0]?.exerciseName).toBe("Bench Press");
    });
  });

  describe("saveLayout", () => {
    it("writes layout to localStorage after debounce delay", async () => {
      const layout = defaultLayout();
      layout.tabs[0]!.name = "Debounced";

      saveLayout(layout, 10); // 10ms debounce for test speed

      expect(localStorage.getItem("colosseum.graphLayout.v1")).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 20));

      const stored = localStorage.getItem("colosseum.graphLayout.v1");
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.tabs[0]?.name).toBe("Debounced");
    });

    it("coalesces multiple saves into one write", async () => {
      const layout1 = defaultLayout();
      const layout2 = defaultLayout();
      layout2.tabs[0]!.name = "Second";

      saveLayout(layout1, 10);
      saveLayout(layout2, 10); // should cancel the first timer

      await new Promise((resolve) => setTimeout(resolve, 20));

      const stored = localStorage.getItem("colosseum.graphLayout.v1");
      const parsed = JSON.parse(stored!);
      expect(parsed.tabs[0]?.name).toBe("Second");
    });

    it("survives localStorage errors silently", async () => {
      const layout = defaultLayout();
      const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("Quota exceeded");
      });

      expect(() => {
        saveLayout(layout, 0);
      }).not.toThrow();

      // Wait for the debounce timer to fire
      await new Promise((resolve) => setTimeout(resolve, 10));

      spy.mockRestore();
    });
  });

  describe("flushSaveLayout", () => {
    it("immediately writes layout, cancelling any pending debounce", async () => {
      const layout = defaultLayout();
      layout.tabs[0]!.name = "Flushed";

      saveLayout(layout, 1000); // very long debounce
      flushSaveLayout(layout); // should flush immediately

      const stored = localStorage.getItem("colosseum.graphLayout.v1");
      const parsed = JSON.parse(stored!);
      expect(parsed.tabs[0]?.name).toBe("Flushed");
    });

    it("survives localStorage errors silently", () => {
      const layout = defaultLayout();
      const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("Quota exceeded");
      });

      expect(() => {
        flushSaveLayout(layout);
      }).not.toThrow();

      spy.mockRestore();
    });
  });

  describe("switchTab", () => {
    it("updates activeTabId and saves the layout", async () => {
      const layout = defaultLayout();
      // Add a second tab so we can switch to it
      const secondTab = { id: "tab-2", name: "Second Tab", carousels: [] };
      layout.tabs.push(secondTab);

      const updated = switchTab(layout, "tab-2");

      expect(updated.activeTabId).toBe("tab-2");
      expect(updated.tabs).toBe(layout.tabs); // tabs unchanged

      // Wait for debounce and verify it was saved
      await new Promise((resolve) => setTimeout(resolve, 250));
      const stored = localStorage.getItem("colosseum.graphLayout.v1");
      const parsed = stored ? JSON.parse(stored) : null;
      expect(parsed?.activeTabId).toBe("tab-2");
    });

    it("returns a new layout object (immutable)", () => {
      const layout = defaultLayout();
      const updated = switchTab(layout, layout.activeTabId); // switch to same tab
      expect(updated).not.toBe(layout);
      expect(updated.activeTabId).toBe(layout.activeTabId);
    });
  });

  describe("getActiveTab", () => {
    it("returns the active tab", () => {
      const layout = defaultLayout();
      const active = getActiveTab(layout);
      expect(active?.id).toBe("tab-main");
      expect(active?.name).toBe("All Lifts");
    });

    it("returns undefined if activeTabId doesn't match any tab", () => {
      const layout = defaultLayout();
      layout.activeTabId = "nonexistent";
      const active = getActiveTab(layout);
      expect(active).toBeUndefined();
    });

    it("returns the correct tab when there are multiple tabs", () => {
      const layout = defaultLayout();
      layout.tabs.push({ id: "tab-2", name: "Second", carousels: [] });
      layout.activeTabId = "tab-2";

      const active = getActiveTab(layout);
      expect(active?.id).toBe("tab-2");
      expect(active?.name).toBe("Second");
    });
  });
});
