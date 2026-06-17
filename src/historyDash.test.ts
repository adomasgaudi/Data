import { describe, it, expect, beforeEach } from "vitest";
import {
  defaultHistoryDashboard, defaultHistoryConfig, makeHistoryTab,
  addHistoryTab, removeHistoryTab, renameHistoryTab, duplicateHistoryTab,
  setActiveHistoryTab, setHistoryTabConfig, activeHistoryTab, normalizeHistoryDashboard,
  loadHistoryDashboardFor, saveHistoryDashboardFor,
} from "./historyDash";

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
beforeEach(() => { installFakeStorage(); });

describe("historyDash model", () => {
  it("default dashboard has one active tab with default config", () => {
    const d = defaultHistoryDashboard();
    expect(d.tabs.length).toBe(1);
    expect(d.activeTabId).toBe(d.tabs[0]!.id);
    expect(activeHistoryTab(d).config).toEqual(defaultHistoryConfig());
  });

  it("add copies the active tab's config and makes the new one active (independent copy)", () => {
    let d = defaultHistoryDashboard();
    d = setHistoryTabConfig(d, d.activeTabId, { ...defaultHistoryConfig(), byExercise: true, rmReps: 5 });
    d = addHistoryTab(d);
    expect(d.tabs.length).toBe(2);
    expect(d.activeTabId).toBe(d.tabs[1]!.id);
    expect(d.tabs[1]!.config.byExercise).toBe(true); // started from the active tab
    // Editing the new tab must NOT change the first tab — completely separate.
    d = setHistoryTabConfig(d, d.activeTabId, { ...d.tabs[1]!.config, byExercise: false });
    expect(d.tabs[0]!.config.byExercise).toBe(true);
    expect(d.tabs[1]!.config.byExercise).toBe(false);
  });

  it("rename + duplicate + setActive are pure and correct", () => {
    let d = defaultHistoryDashboard();
    const id0 = d.activeTabId;
    d = renameHistoryTab(d, id0, "Heavy days");
    expect(d.tabs[0]!.name).toBe("Heavy days");
    d = duplicateHistoryTab(d, id0);
    expect(d.tabs.length).toBe(2);
    expect(d.tabs[1]!.name).toBe("Heavy days copy");
    expect(d.activeTabId).toBe(d.tabs[1]!.id); // copy becomes active
    d = setActiveHistoryTab(d, id0);
    expect(d.activeTabId).toBe(id0);
  });

  it("remove never drops the last tab, and re-points a dangling active", () => {
    let d = defaultHistoryDashboard();
    const only = d.activeTabId;
    expect(removeHistoryTab(d, only)).toBe(d); // can't remove the last one (returns same)
    d = addHistoryTab(d); // now 2, second active
    const second = d.activeTabId;
    d = removeHistoryTab(d, second);
    expect(d.tabs.length).toBe(1);
    expect(d.activeTabId).toBe(only); // snapped back to the survivor
  });

  it("per-athlete storage is fully isolated — one user's tabs never appear for another", () => {
    expect(loadHistoryDashboardFor("ada")).toBeNull(); // nobody has tabs yet
    // Ada makes a "glutes" tab; Ben is untouched.
    let ada = defaultHistoryDashboard();
    ada = renameHistoryTab(ada, ada.activeTabId, "glutes");
    saveHistoryDashboardFor("ada", ada);
    expect(loadHistoryDashboardFor("ada")!.tabs[0]!.name).toBe("glutes");
    expect(loadHistoryDashboardFor("ben")).toBeNull(); // the bug: Ben must NOT see "glutes"
    // Ben makes his own — Ada's is unchanged.
    const ben = defaultHistoryDashboard();
    saveHistoryDashboardFor("ben", renameHistoryTab(ben, ben.activeTabId, "back"));
    expect(loadHistoryDashboardFor("ben")!.tabs[0]!.name).toBe("back");
    expect(loadHistoryDashboardFor("ada")!.tabs[0]!.name).toBe("glutes");
    saveHistoryDashboardFor("", ada); // empty username is a no-op (never crashes)
  });

  it("normalize repairs a dangling activeTabId and rejects junk → default", () => {
    const good = defaultHistoryDashboard();
    const dangling = { ...good, activeTabId: "nope" };
    expect(normalizeHistoryDashboard(dangling).activeTabId).toBe(good.tabs[0]!.id);
    expect(normalizeHistoryDashboard({ garbage: true }).tabs.length).toBe(1);
    expect(normalizeHistoryDashboard(null).tabs.length).toBe(1);
    // A valid hand-built dashboard round-trips.
    const built = { tabs: [makeHistoryTab("A")], activeTabId: "" };
    expect(normalizeHistoryDashboard(built).tabs[0]!.name).toBe("A");
  });
});
