/**
 * Graph configuration layer (TASK 29). The settings that shape a graph, kept as a
 * plain data object SEPARATE from rendering — the Universal Analytics Graph reads
 * it, and future settings plug in here without touching the renderer.
 */
export interface GraphConfig {
  /** How same-interval points are combined: none = every set, else per interval. */
  aggregation: "none" | "max" | "avg" | "sum";
  /** Bucket size when aggregating. */
  interval: "day" | "week" | "month";
  /** Moving-average window in points (0 = off). */
  smoothing: number;
  /** Extend a trend into the future (not migrated yet — a config flag for later). */
  prediction: boolean;
  /** Apply the strength-fade (detraining) model to strength metrics. */
  decay: boolean;
}

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  aggregation: "none",
  interval: "week",
  smoothing: 0,
  prediction: false,
  decay: false,
};
