/**
 * Graph layout configuration (TASK n — refactor tabs + carousels).
 * The structure that defines how graphs are organized: tabs → carousels → graphs.
 * Persisted to localStorage; locked users receive a fixed default.
 */
import { z } from "zod";

/** Configuration for a single graph instance. */
export interface GraphInstance {
  /** Unique ID within its carousel (e.g., "graph-1", "graph-2"). */
  id: string;
  /** Selected exercise name. */
  exerciseName: string;
  /** Graph type: weight over time, or reps vs weight. */
  type: "weight-time" | "reps-weight";
  /** View mode: single exercise, or multiple overlaid. */
  viewMode: "single" | "multi";
}

/** A group of graphs within a tab (rendered as a horizontal carousel). */
export interface CarouselGroup {
  /** Unique ID within its tab (e.g., "carousel-1", "carousel-2"). */
  id: string;
  /** Graphs shown in this carousel. */
  graphs: GraphInstance[];
  /** Current scroll offset (carousel position). Only meaningful at render-time. */
  scrollOffset?: number;
}

/** One tab in the graph layout. */
export interface TabLayout {
  /** Unique ID (e.g., "tab-1", "tab-2", "main"). */
  id: string;
  /** Display name shown in the tab button. */
  name: string;
  /** Carousels within this tab. */
  carousels: CarouselGroup[];
}

/** Complete graph layout for a user (or default for locked/spectator). */
export interface UserGraphLayout {
  /** All tabs, in order. */
  tabs: TabLayout[];
  /** Currently active tab ID. */
  activeTabId: string;
}

/** Example: a default two-tab layout with mixed graph types. */
export const EXAMPLE_LAYOUT: UserGraphLayout = {
  tabs: [
    {
      id: "tab-1",
      name: "Strength",
      carousels: [
        {
          id: "carousel-1-1",
          graphs: [
            {
              id: "graph-1-1-1",
              exerciseName: "Squat",
              type: "weight-time",
              viewMode: "single",
            },
            {
              id: "graph-1-1-2",
              exerciseName: "Bench Press",
              type: "weight-time",
              viewMode: "single",
            },
            {
              id: "graph-1-1-3",
              exerciseName: "Deadlift",
              type: "weight-time",
              viewMode: "single",
            },
          ],
        },
        {
          id: "carousel-1-2",
          graphs: [
            {
              id: "graph-1-2-1",
              exerciseName: "Squat",
              type: "reps-weight",
              viewMode: "multi",
            },
          ],
        },
      ],
    },
    {
      id: "tab-2",
      name: "Volume",
      carousels: [
        {
          id: "carousel-2-1",
          graphs: [
            {
              id: "graph-2-1-1",
              exerciseName: "Squat",
              type: "weight-time",
              viewMode: "multi",
            },
            {
              id: "graph-2-1-2",
              exerciseName: "Bench Press",
              type: "weight-time",
              viewMode: "multi",
            },
          ],
        },
      ],
    },
  ],
  activeTabId: "tab-1",
};

/**
 * Default layout shown to users on first visit (when no saved layout exists).
 * Simple: one tab with one carousel showing the most common exercises.
 */
export function defaultLayout(): UserGraphLayout {
  return {
    tabs: [
      {
        id: "tab-main",
        name: "All Lifts",
        carousels: [
          {
            id: "carousel-main-1",
            graphs: [
              {
                id: "graph-1",
                exerciseName: "Squat",
                type: "weight-time",
                viewMode: "single",
              },
            ],
          },
        ],
      },
    ],
    activeTabId: "tab-main",
  };
}

/**
 * Layout shown to locked users (spectators). Immutable, hard-coded.
 * Same structure as default for consistency, but the UI hides customization controls.
 */
export function lockedDefaultLayout(): UserGraphLayout {
  return defaultLayout();
}

// ============================================================================================
// PERSISTENCE LAYER
// ============================================================================================

const STORAGE_KEY = "colosseum.graphLayout.v1";

const GraphInstanceSchema = z.object({
  id: z.string(),
  exerciseName: z.string(),
  type: z.enum(["weight-time", "reps-weight"]),
  viewMode: z.enum(["single", "multi"]),
});

const CarouselGroupSchema = z.object({
  id: z.string(),
  graphs: z.array(GraphInstanceSchema),
  scrollOffset: z.number().optional(),
}).strict();

const TabLayoutSchema = z.object({
  id: z.string(),
  name: z.string(),
  carousels: z.array(CarouselGroupSchema),
});

const UserGraphLayoutSchema = z.object({
  tabs: z.array(TabLayoutSchema),
  activeTabId: z.string(),
});

/**
 * Load the saved graph layout from localStorage, validating the schema.
 * Falls back to the default layout if no saved layout exists or validation fails.
 */
export function loadLayout(): UserGraphLayout {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultLayout();
    const parsed = JSON.parse(stored);
    const validated = UserGraphLayoutSchema.parse(parsed) as UserGraphLayout;
    return validated;
  } catch {
    return defaultLayout();
  }
}

/** Debounce timer for saveLayout. */
let saveLayoutTimer: number | null = null;

/**
 * Save the graph layout to localStorage. Debounced (200ms) to avoid thrashing.
 * Errors (storage unavailable, quota exceeded) are silent.
 */
export function saveLayout(layout: UserGraphLayout, delayMs = 200): void {
  if (saveLayoutTimer !== null) clearTimeout(saveLayoutTimer);
  saveLayoutTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      /* storage may be unavailable or quota exceeded */
    }
    saveLayoutTimer = null;
  }, delayMs);
}

/** Immediately flush any pending save. */
export function flushSaveLayout(layout: UserGraphLayout): void {
  if (saveLayoutTimer !== null) clearTimeout(saveLayoutTimer);
  saveLayoutTimer = null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* storage may be unavailable */
  }
}
