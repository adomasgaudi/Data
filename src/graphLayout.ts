/**
 * Graph layout configuration (TASK n — refactor tabs + carousels).
 * The structure that defines how graphs are organized: tabs → carousels → graphs.
 * Persisted to localStorage; locked users receive a fixed default.
 */

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
