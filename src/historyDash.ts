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
/** How a history group's exercises are ordered (the ⚙ sort pill cycles these). */
export type HistorySortMode = "priority" | "recency" | "volume" | "logged";

export interface HistoryTabConfig {
  /** Period grouping (Sessions = "day"); ignored when byExercise is on. */
  viewMode: HistoryViewMode;
  /** Group by LIFT (one row per exercise, its sets across dates) instead of by period. */
  byExercise: boolean;
  /** Order each group's exercises by the plan priorities. Kept for back-compat; the
   *  richer choice now lives in `sortMode` (this stays true for any non-"logged" mode). */
  sortByPriority: boolean;
  /** How to order each group's exercises: by plan priority, most-recent, total volume, or
   *  the logged order. Optional + falls back to sortByPriority so old saved tabs migrate. */
  sortMode?: HistorySortMode | undefined;
  showRest: boolean;
  restCompact: boolean;
  showAddSets: boolean;
  showVariants: boolean;
  /** Collapsed-line ×N mode: show every multiplier (true) vs hide chip-implied ones (false/absent). */
  showAllScale?: boolean;
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
    sortMode: "priority",
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
// LOSSLESS by design: each field .catch()-es to its default, so a stored dashboard whose
// shape has DRIFTED (an old save from before we added a field, or a field that no longer
// validates) is REPAIRED field-by-field — keeping every value that still validates —
// instead of the whole dashboard being dropped to a fresh default. That all-or-nothing drop
// was the silent "my tabs reset" bug: with cloud sync on, the wiped default then syncs out
// and the reset propagates to every device. Never wipe a user's customisation on a schema bump.
const DC = defaultHistoryConfig();
// No explicit z.ZodType<…> annotation: .catch() widens each field's INPUT to unknown, which
// is incompatible with the invariant ZodType annotation — so we let Zod infer and rely on the
// structural match to HistoryTabConfig (asserted by the tests + the typed normalize return).
const ConfigSchema = z.object({
  viewMode: z.enum(["day", "week", "2week", "month", "3month"]).catch(DC.viewMode),
  byExercise: z.boolean().catch(DC.byExercise),
  sortByPriority: z.boolean().catch(DC.sortByPriority),
  sortMode: z.enum(["priority", "recency", "volume", "logged"]).optional().catch(DC.sortMode),
  showRest: z.boolean().catch(DC.showRest),
  restCompact: z.boolean().catch(DC.restCompact),
  showAddSets: z.boolean().catch(DC.showAddSets),
  showVariants: z.boolean().catch(DC.showVariants),
  showAllScale: z.boolean().catch(false), // was absent from the schema before → got stripped on load; now persists
  showAloneTags: z.boolean().catch(DC.showAloneTags),
  showMode: z.enum(["exercises", "groups"]).catch(DC.showMode),
  grouping: z.string().catch(DC.grouping),
  rmReps: z.number().catch(DC.rmReps),
  aloneFilter: z.enum(["both", "alone", "notAlone"]).catch(DC.aloneFilter),
  lensFilter: z.array(z.string()).catch(DC.lensFilter),
  showAll: z.boolean().catch(DC.showAll),
});
const TabSchema = z.object({
  id: z.string(),
  name: z.string(),
  config: ConfigSchema,
});
// Tabs/activeTabId also .catch() so a dashboard with valid tabs but one odd field is kept
// (empty/garbage tabs fall through to the default in normalizeHistoryDashboard).
const DashboardSchema = z.object({
  tabs: z.array(TabSchema).catch([]),
  activeTabId: z.string().catch(""),
});

/** Coerce arbitrary loaded JSON into a valid dashboard, or fall back to default. Repairs a
 * dangling activeTabId (points at a removed tab) by snapping to the first tab. */
export function normalizeHistoryDashboard(raw: unknown): HistoryDashboard {
  const parsed = DashboardSchema.safeParse(raw);
  // Only fall back to a fresh default when there's genuinely nothing usable (not an object,
  // or no tabs survived). A dashboard with ≥1 tab is REPAIRED, never replaced.
  if (!parsed.success || !parsed.data.tabs.length) return defaultHistoryDashboard();
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
    // Keep a user as long as their stored dashboard has ≥1 repairable tab (lossless parse).
    // A user with genuinely no usable tabs is omitted → the caller seeds a fresh default,
    // but a user with valid tabs is NEVER dropped (which would wipe their customisation).
    const parsed = DashboardSchema.safeParse(d);
    if (parsed.success && parsed.data.tabs.length) out[user] = normalizeHistoryDashboard(parsed.data);
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
  all[user] = stripTempHistory(d); // the temporary jump tab is session-only — never persist it
  saveJson(HISTORY_DASH_KEY_V2, all);
}

// ---- TEMPORARY jump tab (owner) --------------------------------------------
// Jump-to-exercise actions (see-in-history) target this ONE session-only tab so the owner's
// saved custom tabs are never overridden; it's stripped before persisting, so a refresh
// resets it. Each jump REPLACES it (same fixed id) and makes it active.
export const TEMP_HISTORY_TAB_ID = "__temp__";
export function setTempHistoryTab(d: HistoryDashboard, exercises: string[], name = "↪ temp"): HistoryDashboard {
  const tab: HistoryTab = { id: TEMP_HISTORY_TAB_ID, name, config: { ...defaultHistoryConfig(), lensFilter: [...exercises] } };
  const has = d.tabs.some((t) => t.id === TEMP_HISTORY_TAB_ID);
  const tabs = has ? d.tabs.map((t) => (t.id === TEMP_HISTORY_TAB_ID ? tab : t)) : [...d.tabs, tab];
  return { tabs, activeTabId: TEMP_HISTORY_TAB_ID };
}
/** Remove the temporary tab (used at the persist boundary, and on refresh-reset). */
export function stripTempHistory(d: HistoryDashboard): HistoryDashboard {
  if (!d.tabs.some((t) => t.id === TEMP_HISTORY_TAB_ID)) return d;
  const tabs = d.tabs.filter((t) => t.id !== TEMP_HISTORY_TAB_ID);
  if (!tabs.length) return defaultHistoryDashboard();
  const activeTabId = tabs.some((t) => t.id === d.activeTabId) ? d.activeTabId : tabs[0]!.id;
  return { tabs, activeTabId };
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
