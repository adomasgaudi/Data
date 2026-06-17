import { describe, it, expect } from "vitest";
import {
  defaultDashboard,
  makeBubble,
  makeTab,
  normalizeDashboard,
  setActiveTab,
  addTab,
  removeTab,
  renameTab,
  addBubble,
  removeBubble,
  duplicateBubble,
  duplicateTab,
  updateBubble,
  setBubbleView,
  cycleBubbleType,
  cycleBubbleView,
  activeTab,
  tabById,
  type GraphDashboard,
} from "./graphDash";

describe("graphDash — constructors & defaults", () => {
  it("defaultDashboard has one tab with one starter bubble, active set to it", () => {
    const d = defaultDashboard();
    expect(d.tabs).toHaveLength(1);
    expect(d.tabs[0]!.bubbles).toHaveLength(1);
    expect(d.activeTabId).toBe(d.tabs[0]!.id);
    const b = d.tabs[0]!.bubbles[0]!;
    expect(b.type).toBe("time");
    expect(b.view).toBe("single");
    expect(b.metrics).toEqual(["e1rm"]);
  });

  it("makeBubble applies overrides and copies arrays (no aliasing)", () => {
    const ex = ["Squat"];
    const b = makeBubble({ type: "rvw", view: "multi", exercises: ex, perBodyweight: true });
    expect(b.type).toBe("rvw");
    expect(b.view).toBe("multi");
    expect(b.perBodyweight).toBe(true);
    expect(b.exercises).toEqual(["Squat"]);
    expect(b.exercises).not.toBe(ex); // defensively copied
  });

  it("fresh ids are unique across rapid creation", () => {
    const ids = new Set(Array.from({ length: 50 }, () => makeBubble().id));
    expect(ids.size).toBe(50);
  });
});

describe("graphDash — tab transforms (immutable)", () => {
  it("addTab appends and activates the new tab without mutating the original", () => {
    const d0 = defaultDashboard();
    const d1 = addTab(d0, "Cardio");
    expect(d0.tabs).toHaveLength(1); // original untouched
    expect(d1.tabs).toHaveLength(2);
    expect(d1.tabs[1]!.name).toBe("Cardio");
    expect(d1.activeTabId).toBe(d1.tabs[1]!.id);
  });

  it("removeTab drops the tab and re-points active; refuses the last tab", () => {
    let d = defaultDashboard();
    const first = d.tabs[0]!.id;
    d = addTab(d, "B"); // active = B
    const second = d.activeTabId;
    d = removeTab(d, second); // removing active → snaps to remaining
    expect(d.tabs).toHaveLength(1);
    expect(d.activeTabId).toBe(first);
    const guarded = removeTab(d, first); // last tab can't go
    expect(guarded.tabs).toHaveLength(1);
  });

  it("renameTab changes only the named tab", () => {
    let d = addTab(defaultDashboard(), "B");
    const id = d.tabs[1]!.id;
    d = renameTab(d, id, "Renamed");
    expect(tabById(d, id)!.name).toBe("Renamed");
    expect(d.tabs[0]!.name).toBe("Graphs");
  });

  it("setActiveTab ignores unknown ids", () => {
    const d = defaultDashboard();
    expect(setActiveTab(d, "nope").activeTabId).toBe(d.activeTabId);
    expect(setActiveTab(d, d.tabs[0]!.id).activeTabId).toBe(d.tabs[0]!.id);
  });

  it("activeTab resolves the active tab (or first as fallback)", () => {
    const d = addTab(defaultDashboard(), "B");
    expect(activeTab(d).id).toBe(d.activeTabId);
  });
});

describe("graphDash — bubble transforms (immutable)", () => {
  it("addBubble / removeBubble manage the reel; never empties a tab", () => {
    let d = defaultDashboard();
    const tab = d.tabs[0]!.id;
    d = addBubble(d, tab, { type: "rvw" });
    expect(tabById(d, tab)!.bubbles).toHaveLength(2);
    const last = tabById(d, tab)!.bubbles[1]!.id;
    d = removeBubble(d, tab, last);
    expect(tabById(d, tab)!.bubbles).toHaveLength(1);
    const onlyId = tabById(d, tab)!.bubbles[0]!.id;
    d = removeBubble(d, tab, onlyId); // guarded — last bubble stays
    expect(tabById(d, tab)!.bubbles).toHaveLength(1);
  });

  it("updateBubble patches fields but preserves the id", () => {
    const d0 = defaultDashboard();
    const tab = d0.tabs[0]!.id;
    const bid = d0.tabs[0]!.bubbles[0]!.id;
    const d1 = updateBubble(d0, tab, bid, { exercises: ["Bench"], id: "hacked" });
    const b = tabById(d1, tab)!.bubbles[0]!;
    expect(b.exercises).toEqual(["Bench"]);
    expect(b.id).toBe(bid); // id is not overwritable via patch
    expect(d0.tabs[0]!.bubbles[0]!.exercises).toEqual([]); // original untouched
  });

  it("duplicateBubble inserts a same-config copy with a fresh id right after", () => {
    let d = defaultDashboard();
    const tab = d.tabs[0]!.id;
    d = updateBubble(d, tab, d.tabs[0]!.bubbles[0]!.id, { type: "rvw", exercises: ["Squat"] });
    const srcId = d.tabs[0]!.bubbles[0]!.id;
    d = duplicateBubble(d, tab, srcId);
    const bs = tabById(d, tab)!.bubbles;
    expect(bs).toHaveLength(2);
    expect(bs[1]!.id).not.toBe(srcId); // fresh id
    expect(bs[1]!.type).toBe("rvw"); // same config
    expect(bs[1]!.exercises).toEqual(["Squat"]);
    expect(bs[1]!.exercises).not.toBe(bs[0]!.exercises); // not aliased
  });

  it("duplicateTab copies the tab (re-id'd bubbles, ' copy' name) and activates it", () => {
    let d = defaultDashboard();
    const srcTab = d.tabs[0]!;
    d = updateBubble(d, srcTab.id, srcTab.bubbles[0]!.id, { exercises: ["Bench"] });
    d = duplicateTab(d, srcTab.id);
    expect(d.tabs).toHaveLength(2);
    expect(d.tabs[1]!.name).toBe("Graphs copy");
    expect(d.activeTabId).toBe(d.tabs[1]!.id);
    expect(d.tabs[1]!.id).not.toBe(d.tabs[0]!.id);
    expect(d.tabs[1]!.bubbles[0]!.id).not.toBe(d.tabs[0]!.bubbles[0]!.id); // bubbles re-id'd
    expect(d.tabs[1]!.bubbles[0]!.exercises).toEqual(["Bench"]); // config carried
  });

  it("cycleBubbleType cycles time ⇄ rvw", () => {
    const d0 = defaultDashboard();
    const tab = d0.tabs[0]!.id;
    const bid = d0.tabs[0]!.bubbles[0]!.id;
    const d1 = cycleBubbleType(d0, tab, bid);
    expect(tabById(d1, tab)!.bubbles[0]!.type).toBe("rvw");
    const d2 = cycleBubbleType(d1, tab, bid);
    expect(tabById(d2, tab)!.bubbles[0]!.type).toBe("time");
  });

  it("cycleBubbleView cycles single ⇄ multi", () => {
    const d0 = defaultDashboard();
    const tab = d0.tabs[0]!.id;
    const bid = d0.tabs[0]!.bubbles[0]!.id;
    const d1 = cycleBubbleView(d0, tab, bid);
    expect(tabById(d1, tab)!.bubbles[0]!.view).toBe("multi");
    expect(cycleBubbleView(d1, tab, bid).tabs[0]!.bubbles[0]!.view).toBe("single");
  });
});

describe("graphDash — normalize (load-boundary validation)", () => {
  it("garbage / empty → default dashboard", () => {
    expect(normalizeDashboard(null).tabs).toHaveLength(1);
    expect(normalizeDashboard({}).tabs).toHaveLength(1);
    expect(normalizeDashboard({ tabs: [] }).tabs).toHaveLength(1); // min(1) fails → default
    expect(normalizeDashboard({ tabs: [{ id: "t", name: "x", bubbles: [] }], activeTabId: "t" }).tabs)
      .toHaveLength(1); // a tab with no bubbles is invalid → default
  });

  it("a valid dashboard round-trips unchanged", () => {
    const d: GraphDashboard = {
      tabs: [makeTab("Keep", [makeBubble({ type: "rvw", exercises: ["Squat"] })])],
      activeTabId: "",
    };
    d.activeTabId = d.tabs[0]!.id;
    const n = normalizeDashboard(d);
    expect(n.tabs[0]!.name).toBe("Keep");
    expect(n.tabs[0]!.bubbles[0]!.type).toBe("rvw");
    expect(n.activeTabId).toBe(d.tabs[0]!.id);
  });

  it("repairs a dangling activeTabId by snapping to the first tab", () => {
    const t = makeTab("A");
    const n = normalizeDashboard({ tabs: [t], activeTabId: "ghost" });
    expect(n.activeTabId).toBe(t.id);
  });
});

describe("graphDash — savedView (remembered pan/zoom)", () => {
  it("new bubble starts with no saved view", () => {
    expect(makeBubble().savedView ?? null).toBeNull();
  });

  it("setBubbleView stores and clears the view without touching config", () => {
    let d: GraphDashboard = defaultDashboard();
    const tab = d.tabs[0]!;
    const b = tab.bubbles[0]!;
    const box = { xMin: 1, xMax: 10, yMin: 0, yMax: 5 };
    d = setBubbleView(d, tab.id, b.id, { sig: "abc", box });
    const stored = activeTab(d).bubbles[0]!;
    expect(stored.savedView).toEqual({ sig: "abc", box });
    expect(stored.type).toBe(b.type); // config untouched
    d = setBubbleView(d, tab.id, b.id, null);
    expect(activeTab(d).bubbles[0]!.savedView).toBeNull();
  });

  it("a saved view survives the Zod load boundary", () => {
    const box = { xMin: 1700000000000, xMax: 1710000000000, yMin: 20, yMax: 80 };
    const d: GraphDashboard = {
      tabs: [makeTab("V", [makeBubble({ savedView: { sig: "s1", box } })])],
      activeTabId: "",
    };
    d.activeTabId = d.tabs[0]!.id;
    const n = normalizeDashboard(JSON.parse(JSON.stringify(d)));
    expect(n.tabs[0]!.bubbles[0]!.savedView).toEqual({ sig: "s1", box });
  });

  it("a malformed saved view is rejected at the boundary (→ default)", () => {
    const bad = {
      tabs: [{ id: "t", name: "x", bubbles: [{ ...makeBubble(), savedView: { sig: "s", box: { xMin: "no" } } }] }],
      activeTabId: "t",
    };
    expect(normalizeDashboard(bad).tabs[0]!.bubbles[0]!.savedView ?? null).toBeNull();
  });
});
