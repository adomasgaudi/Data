/**
 * Custom graph dashboard — the SSOT data model for the owner's build-your-own graph
 * setup (docs/graph-dashboard-plan.md). Tabs → bubbles (a horizontal swipe reel) → each
 * bubble is one self-contained graph config. This module is PURE data + storage: no DOM,
 * no globals. The render layer (later phases) reads a bubble and feeds the proven
 * analyticsGraph.ts engine — this file never draws.
 *
 * Persisted at `colosseum.graphDash.v1`, Zod-validated at the load boundary (invalid or
 * missing → a sane default), matching the rest of the per-device override stores. Treated
 * as a local-only DISPLAY pref (like the other wa* view toggles) for now.
 *
 * The 4 owner-named graph kinds fall out of (type × view):
 *   single graph = time + single · multigraph = time + multi
 *   reps × weight = rvw · weight × time = time
 */
import { z } from "zod";
import { loadJsonObject, saveJson } from "./storage";

export const GRAPH_DASH_KEY = "colosseum.graphDash.v1";

/** time = a metric over time (the classic line/bar view); rvw = reps-vs-weight scatter. */
export type GraphType = "time" | "rvw";
/** single = focus one lift; multi = overlay several lifts (and/or several athletes). */
export type GraphView = "single" | "multi";

/** One graph in the reel — a fully self-contained config (no shared/global state). */
export interface GraphBubble {
  id: string;
  type: GraphType;
  view: GraphView;
  /** Lift names to plot. single uses exercises[0]; multi overlays them all. [] = unset. */
  exercises: string[];
  /** Athlete usernames to overlay; [] = the current athlete only. */
  athletes: string[];
  /** Show kg metrics as multiples of bodyweight (×BW). */
  perBodyweight: boolean;
  /** Metric ids for the time view (e.g. "e1rm", "volume"); ignored by rvw. */
  metrics: string[];
}

/** A named tab holding a reel of bubbles. */
export interface GraphTab {
  id: string;
  name: string;
  bubbles: GraphBubble[];
}

/** The whole dashboard: the tabs plus which one is active. */
export interface GraphDashboard {
  tabs: GraphTab[];
  activeTabId: string;
}

export const GRAPH_TYPES: GraphType[] = ["time", "rvw"];
export const GRAPH_VIEWS: GraphView[] = ["single", "multi"];

// ---- ids -------------------------------------------------------------------
// Monotonic + random so a fresh bubble/tab never collides, even within one tick.
let idSeq = 0;
function freshId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ---- constructors (pure) ---------------------------------------------------
/** A new empty-ish bubble. Defaults to the classic single-lift time view. */
export function makeBubble(partial: Partial<GraphBubble> = {}): GraphBubble {
  return {
    id: partial.id ?? freshId("b"),
    type: partial.type ?? "time",
    view: partial.view ?? "single",
    exercises: partial.exercises ? [...partial.exercises] : [],
    athletes: partial.athletes ? [...partial.athletes] : [],
    perBodyweight: partial.perBodyweight ?? false,
    metrics: partial.metrics ? [...partial.metrics] : ["e1rm"],
  };
}

/** A new tab with one starter bubble. */
export function makeTab(name = "Graphs", bubbles?: GraphBubble[]): GraphTab {
  return { id: freshId("t"), name, bubbles: bubbles && bubbles.length ? bubbles : [makeBubble()] };
}

/** The fallback dashboard: one tab, one starter bubble. */
export function defaultDashboard(): GraphDashboard {
  const t = makeTab();
  return { tabs: [t], activeTabId: t.id };
}

// ---- validation (Zod, at the load boundary) --------------------------------
const BubbleSchema: z.ZodType<GraphBubble> = z.object({
  id: z.string(),
  type: z.enum(["time", "rvw"]),
  view: z.enum(["single", "multi"]),
  exercises: z.array(z.string()),
  athletes: z.array(z.string()),
  perBodyweight: z.boolean(),
  metrics: z.array(z.string()),
});
const TabSchema: z.ZodType<GraphTab> = z.object({
  id: z.string(),
  name: z.string(),
  bubbles: z.array(BubbleSchema).min(1), // a tab always has at least one bubble
});
const DashboardSchema: z.ZodType<GraphDashboard> = z.object({
  tabs: z.array(TabSchema).min(1),
  activeTabId: z.string(),
});

/** Coerce arbitrary loaded JSON into a valid dashboard, or fall back to default. Also
 * repairs a dangling activeTabId (points at a removed tab) by snapping to the first tab. */
export function normalizeDashboard(raw: unknown): GraphDashboard {
  const parsed = DashboardSchema.safeParse(raw);
  if (!parsed.success) return defaultDashboard();
  const d = parsed.data;
  if (!d.tabs.some((t) => t.id === d.activeTabId)) d.activeTabId = d.tabs[0]!.id;
  return d;
}

// ---- persistence -----------------------------------------------------------
export function loadDashboard(): GraphDashboard {
  return normalizeDashboard(loadJsonObject<Record<string, unknown>>(GRAPH_DASH_KEY));
}
export function saveDashboard(d: GraphDashboard): void {
  saveJson(GRAPH_DASH_KEY, d);
}

// ---- pure transforms (return a NEW dashboard; never mutate in place) --------
const mapTab = (d: GraphDashboard, tabId: string, fn: (t: GraphTab) => GraphTab): GraphDashboard => ({
  ...d,
  tabs: d.tabs.map((t) => (t.id === tabId ? fn(t) : t)),
});
const mapBubble = (
  d: GraphDashboard,
  tabId: string,
  bubbleId: string,
  fn: (b: GraphBubble) => GraphBubble,
): GraphDashboard =>
  mapTab(d, tabId, (t) => ({ ...t, bubbles: t.bubbles.map((b) => (b.id === bubbleId ? fn(b) : b)) }));

export function setActiveTab(d: GraphDashboard, tabId: string): GraphDashboard {
  return d.tabs.some((t) => t.id === tabId) ? { ...d, activeTabId: tabId } : d;
}

/** Add a new tab and make it active. */
export function addTab(d: GraphDashboard, name?: string): GraphDashboard {
  const t = makeTab(name ?? `Tab ${d.tabs.length + 1}`);
  return { tabs: [...d.tabs, t], activeTabId: t.id };
}

/** Remove a tab. Refuses to remove the last one. Re-points active if needed. */
export function removeTab(d: GraphDashboard, tabId: string): GraphDashboard {
  if (d.tabs.length <= 1) return d;
  const tabs = d.tabs.filter((t) => t.id !== tabId);
  const activeTabId = d.activeTabId === tabId ? tabs[0]!.id : d.activeTabId;
  return { tabs, activeTabId };
}

export function renameTab(d: GraphDashboard, tabId: string, name: string): GraphDashboard {
  return mapTab(d, tabId, (t) => ({ ...t, name }));
}

/** Add a bubble to a tab (optionally a preconfigured one). */
export function addBubble(d: GraphDashboard, tabId: string, bubble?: Partial<GraphBubble>): GraphDashboard {
  return mapTab(d, tabId, (t) => ({ ...t, bubbles: [...t.bubbles, makeBubble(bubble)] }));
}

/** Duplicate a bubble — insert a fresh-id copy (same config) right after it. */
export function duplicateBubble(d: GraphDashboard, tabId: string, bubbleId: string): GraphDashboard {
  return mapTab(d, tabId, (t) => {
    const idx = t.bubbles.findIndex((b) => b.id === bubbleId);
    if (idx < 0) return t;
    const { id: _drop, ...cfg } = t.bubbles[idx]!; // fresh id, same config
    const copy = makeBubble(cfg);
    return { ...t, bubbles: [...t.bubbles.slice(0, idx + 1), copy, ...t.bubbles.slice(idx + 1)] };
  });
}

/** Duplicate a tab — a fresh-id copy (all bubbles re-id'd, name + " copy"), inserted after it
 * and made active. */
export function duplicateTab(d: GraphDashboard, tabId: string): GraphDashboard {
  const idx = d.tabs.findIndex((t) => t.id === tabId);
  if (idx < 0) return d;
  const src = d.tabs[idx]!;
  const copy = makeTab(`${src.name} copy`, src.bubbles.map(({ id: _drop, ...cfg }) => makeBubble(cfg)));
  return { tabs: [...d.tabs.slice(0, idx + 1), copy, ...d.tabs.slice(idx + 1)], activeTabId: copy.id };
}

/** Remove a bubble. Refuses to remove the last bubble in a tab (a tab always shows one). */
export function removeBubble(d: GraphDashboard, tabId: string, bubbleId: string): GraphDashboard {
  return mapTab(d, tabId, (t) =>
    t.bubbles.length <= 1 ? t : { ...t, bubbles: t.bubbles.filter((b) => b.id !== bubbleId) },
  );
}

/** Patch a bubble's fields. */
export function updateBubble(
  d: GraphDashboard,
  tabId: string,
  bubbleId: string,
  patch: Partial<GraphBubble>,
): GraphDashboard {
  return mapBubble(d, tabId, bubbleId, (b) => ({ ...b, ...patch, id: b.id }));
}

/** Cycle a bubble's graph type (time ⇄ rvw) — the #toggle pill. */
export function cycleBubbleType(d: GraphDashboard, tabId: string, bubbleId: string): GraphDashboard {
  return mapBubble(d, tabId, bubbleId, (b) => ({
    ...b,
    type: GRAPH_TYPES[(GRAPH_TYPES.indexOf(b.type) + 1) % GRAPH_TYPES.length]!,
  }));
}

/** Cycle a bubble's view (single ⇄ multi) — the #toggle pill. */
export function cycleBubbleView(d: GraphDashboard, tabId: string, bubbleId: string): GraphDashboard {
  return mapBubble(d, tabId, bubbleId, (b) => ({
    ...b,
    view: GRAPH_VIEWS[(GRAPH_VIEWS.indexOf(b.view) + 1) % GRAPH_VIEWS.length]!,
  }));
}

/** Find a tab by id (or the active tab). Read helper for the render layer. */
export function tabById(d: GraphDashboard, tabId: string): GraphTab | undefined {
  return d.tabs.find((t) => t.id === tabId);
}
export function activeTab(d: GraphDashboard): GraphTab {
  return tabById(d, d.activeTabId) ?? d.tabs[0]!;
}
