/**
 * History dashboard — the SSOT data model for the owner's build-your-own WORKOUT-HISTORY
 * tabs (the analogue of graphDash.ts for the graph). Each tab is a NAMED, fully
 * self-contained history view: its own grouping (Sessions / By exercise / By week /
 * month…), sort, filters, rest/extra toggles and exercise-lens selection. Changing one
 * tab never touches another. This module is PURE data + storage: no DOM, no globals; the
 * render layer (main.ts) reads a tab's config and feeds the existing history render.
 *
 * Persisted at `colosseum.historyDash.v1`, Zod-validated at the load boundary (invalid or
 * missing → a sane default), like the other per-device override stores. Local-only DISPLAY
 * pref (each device its own tabs), matching the wa* / graphDash view state.
 */
import { z } from "zod";
import { loadJsonObject, saveJson } from "./storage";

export const HISTORY_DASH_KEY = "colosseum.historyDash.v1";

export type HistoryViewMode = "day" | "week" | "2week" | "month" | "3month";
export type HistoryAloneFilter = "both" | "alone" | "notAlone";
export type HistoryShowMode = "exercises" | "groups";

/** One history tab's COMPLETE, independent view config — every setting the ⚙ console +
 * the exercise picker drive, snapshotted per tab so tabs never share state. */
export interface HistoryTabConfig {
  /** Period grouping (Sessions = "day"); ignored when byExercise is on. */
  viewMode: HistoryViewMode;
  /** Group by LIFT (one row per exercise, its sets across dates) instead of by period. */
  byExercise: boolean;
  /** Order each group's exercises by the plan priorities. */
  sortByPriority: boolean;
  showRest: boolean;
  restCompact: boolean;
  showAddSets: boolean;
  showVariants: boolean;
  showAloneTags: boolean;
  showMode: HistoryShowMode;
  /** Group-by dimension when showMode = "groups" (muscles / functional / combined / compared). */
  grouping: string;
  /** The "golden number" rep-max shown per lift (1 = 1RM, else the X-RM). */
  rmReps: number;
  aloneFilter: HistoryAloneFilter;
  /** The history exercise-lens selection (names). [] = all (no lens). */
  lensFilter: string[];
  /** Ignore the Index app-wide filter for this view (show hidden lifts). */
  showAll: boolean;
}

export interface HistoryTab {
  id: string;
  name: string;
  config: HistoryTabConfig;
}

export interface HistoryDashboard {
  tabs: HistoryTab[];
  activeTabId: string;
}

/** The default config for a fresh tab — matches the app's historical defaults. */
export function defaultHistoryConfig(): HistoryTabConfig {
  return {
    viewMode: "day",
    byExercise: false,
    sortByPriority: true,
    showRest: false,
    restCompact: false,
    showAddSets: false,
    showVariants: false,
    showAloneTags: false,
    showMode: "exercises",
    grouping: "muscles",
    rmReps: 1,
    aloneFilter: "both",
    lensFilter: [],
    showAll: false,
  };
}

// ---- ids (monotonic + random so a fresh tab never collides within a tick) ----
let idSeq = 0;
function freshId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function makeHistoryTab(name = "History", config?: Partial<HistoryTabConfig>): HistoryTab {
  return { id: freshId("h"), name, config: { ...defaultHistoryConfig(), ...config } };
}

/** The fallback dashboard: a single "History" tab with default settings. */
export function defaultHistoryDashboard(): HistoryDashboard {
  const t = makeHistoryTab();
  return { tabs: [t], activeTabId: t.id };
}

// ---- validation (Zod, at the load boundary) --------------------------------
const ConfigSchema: z.ZodType<HistoryTabConfig> = z.object({
  viewMode: z.enum(["day", "week", "2week", "month", "3month"]),
  byExercise: z.boolean(),
  sortByPriority: z.boolean(),
  showRest: z.boolean(),
  restCompact: z.boolean(),
  showAddSets: z.boolean(),
  showVariants: z.boolean(),
  showAloneTags: z.boolean(),
  showMode: z.enum(["exercises", "groups"]),
  grouping: z.string(),
  rmReps: z.number(),
  aloneFilter: z.enum(["both", "alone", "notAlone"]),
  lensFilter: z.array(z.string()),
  showAll: z.boolean(),
});
const TabSchema: z.ZodType<HistoryTab> = z.object({
  id: z.string(),
  name: z.string(),
  config: ConfigSchema,
});
const DashboardSchema: z.ZodType<HistoryDashboard> = z.object({
  tabs: z.array(TabSchema).min(1),
  activeTabId: z.string(),
});

/** Coerce arbitrary loaded JSON into a valid dashboard, or fall back to default. Repairs a
 * dangling activeTabId (points at a removed tab) by snapping to the first tab. */
export function normalizeHistoryDashboard(raw: unknown): HistoryDashboard {
  const parsed = DashboardSchema.safeParse(raw);
  if (!parsed.success) return defaultHistoryDashboard();
  const d = parsed.data;
  if (!d.tabs.some((t) => t.id === d.activeTabId)) d.activeTabId = d.tabs[0]!.id;
  return d;
}

export function loadHistoryDashboard(): HistoryDashboard {
  return normalizeHistoryDashboard(loadJsonObject<Record<string, unknown>>(HISTORY_DASH_KEY));
}
export function saveHistoryDashboard(d: HistoryDashboard): void {
  saveJson(HISTORY_DASH_KEY, d);
}

// ---- per-athlete persistence -----------------------------------------------
// Each athlete gets their OWN history tabs (a "glutes" tab made for one user must NOT
// appear for another). Stored as a MAP username → dashboard under a v2 key, mirroring
// graphDash; the single-dashboard load/save above is kept for the pure tests.
export const HISTORY_DASH_KEY_V2 = "colosseum.historyDash.v2";

function loadAllHistoryDashboards(): Record<string, HistoryDashboard> {
  const raw = loadJsonObject<Record<string, unknown>>(HISTORY_DASH_KEY_V2);
  const out: Record<string, HistoryDashboard> = {};
  for (const [user, d] of Object.entries(raw)) {
    const parsed = DashboardSchema.safeParse(d);
    if (parsed.success) out[user] = normalizeHistoryDashboard(parsed.data);
  }
  return out;
}
/** The stored dashboard for one athlete, or null if they have none yet (→ caller seeds). */
export function loadHistoryDashboardFor(user: string): HistoryDashboard | null {
  return loadAllHistoryDashboards()[user] ?? null;
}
export function saveHistoryDashboardFor(user: string, d: HistoryDashboard): void {
  if (!user) return;
  const all = loadAllHistoryDashboards();
  all[user] = d;
  saveJson(HISTORY_DASH_KEY_V2, all);
}

// ---- pure tab operations (return a NEW dashboard; never mutate) -------------
export function activeHistoryTab(d: HistoryDashboard): HistoryTab {
  return d.tabs.find((t) => t.id === d.activeTabId) ?? d.tabs[0]!;
}
/** Add a new tab (copying the active tab's config so it starts where you are) and make it active. */
export function addHistoryTab(d: HistoryDashboard, name?: string): HistoryDashboard {
  const base = activeHistoryTab(d).config;
  const t = makeHistoryTab(name ?? `Tab ${d.tabs.length + 1}`, { ...base });
  return { tabs: [...d.tabs, t], activeTabId: t.id };
}
/** Duplicate a tab (config and all), placing the copy after it and making it active. */
export function duplicateHistoryTab(d: HistoryDashboard, id: string): HistoryDashboard {
  const i = d.tabs.findIndex((t) => t.id === id);
  if (i < 0) return d;
  const copy = makeHistoryTab(`${d.tabs[i]!.name} copy`, { ...d.tabs[i]!.config });
  const tabs = [...d.tabs.slice(0, i + 1), copy, ...d.tabs.slice(i + 1)];
  return { tabs, activeTabId: copy.id };
}
/** Remove a tab; never removes the last one. Snaps active to a neighbour if needed. */
export function removeHistoryTab(d: HistoryDashboard, id: string): HistoryDashboard {
  if (d.tabs.length <= 1) return d;
  const i = d.tabs.findIndex((t) => t.id === id);
  if (i < 0) return d;
  const tabs = d.tabs.filter((t) => t.id !== id);
  const activeTabId = d.activeTabId === id ? (tabs[Math.max(0, i - 1)]!.id) : d.activeTabId;
  return { tabs, activeTabId };
}
export function renameHistoryTab(d: HistoryDashboard, id: string, name: string): HistoryDashboard {
  return { ...d, tabs: d.tabs.map((t) => (t.id === id ? { ...t, name } : t)) };
}
export function setActiveHistoryTab(d: HistoryDashboard, id: string): HistoryDashboard {
  return d.tabs.some((t) => t.id === id) ? { ...d, activeTabId: id } : d;
}
/** Write a config into a tab (used to snapshot the live view back into the active tab). */
export function setHistoryTabConfig(d: HistoryDashboard, id: string, config: HistoryTabConfig): HistoryDashboard {
  return { ...d, tabs: d.tabs.map((t) => (t.id === id ? { ...t, config } : t)) };
}
