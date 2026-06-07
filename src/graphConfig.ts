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
  /** Fill opacity (0..1) for bar series (e.g. Volume), so they don't hide other
   * series. Default 0.6 — a touch more solid than the scatter dots. */
  opacity: number;
  /** Right-axis height scale: 1 = auto; >1 makes the right-axis series (counts /
   * volume) sit shorter, <1 makes them taller — a relative-axis knob. */
  rightHeadroom: number;
  /** Slide ONLY the Volume / Volume Load bars left/right along the x-axis by this
   * many days, relative to the other series (1RM lines etc.) on the same chart.
   * 0 = aligned to their real dates; negative shifts the bars earlier, positive
   * later — used to line volume up against the strength it produced. */
  volumeXShift: number;
}

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  aggregation: "none",
  interval: "week",
  smoothing: 0,
  prediction: false,
  decay: false,
  formula: "epley",
  predictionDays: 90,
  opacity: 0.6,
  rightHeadroom: 1,
  volumeXShift: 0,
};
