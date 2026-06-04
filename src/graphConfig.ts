/**
 * Graph configuration layer (TASK 29). The settings that shape a graph, kept as a
 * plain data object SEPARATE from rendering — the Universal Analytics Graph reads
 * it, and future settings plug in here without touching the renderer.
 */
import type { OneRepMaxFormula } from "./metrics";

export interface GraphConfig {
  /** How same-interval points are combined: none = every set, else per interval. */
  aggregation: "none" | "max" | "avg" | "sum";
  /** Bucket size when aggregating. */
  interval: "day" | "week" | "month";
  /** Moving-average window in points (0 = off). */
  smoothing: number;
  /** Extend a trend into the future (a general flag; the Predicted metric projects). */
  prediction: boolean;
  /** Apply the strength-fade (detraining) model to strength metrics. */
  decay: boolean;
  /** 1RM formula for the strength/1RM metrics (matches the app-wide choice). */
  formula: OneRepMaxFormula;
  /** How far ahead the Predicted Strength metric projects, in days. */
  predictionDays: number;
}

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  aggregation: "none",
  interval: "week",
  smoothing: 0,
  prediction: false,
  decay: false,
  formula: "epley",
  predictionDays: 90,
};
