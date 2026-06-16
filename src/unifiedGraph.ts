/**
 * Universal Graph Component (Part 5 of refactor).
 * Merges single-view and multi-view graph rendering into one component.
 * Routes rendering based on type (weight-time | reps-weight) and viewMode (single | multi).
 */

import type { GraphInstance } from "./graphLayout";
import type { GraphConfig } from "./graphConfig";
import type { SetRecord } from "./domain";

/**
 * Configuration for rendering a unified graph.
 */
export interface UnifiedGraphProps {
  graph: GraphInstance;
  records: SetRecord[]; // data for this exercise
  graphConfig: GraphConfig; // render options (smoothing, aggregation, etc.)
  containerId: string; // where to render (e.g., ".wa-graph-content")
}

/**
 * Render a unified graph based on type and viewMode.
 * Currently a stub — the actual rendering will wire into analyticsGraph.ts
 * or the existing graph rendering pipeline.
 */
export function renderUnifiedGraph(props: UnifiedGraphProps): void {
  const { graph, records, graphConfig, containerId } = props;

  // Find the container
  const container = document.querySelector(containerId) as HTMLElement | null;
  if (!container) return;

  // Route based on type and viewMode
  const renderKey = `${graph.type}:${graph.viewMode}`;

  switch (renderKey) {
    case "weight-time:single":
      renderWeightTimeSingle(container, graph, records, graphConfig);
      break;
    case "weight-time:multi":
      renderWeightTimeMulti(container, graph, records, graphConfig);
      break;
    case "reps-weight:single":
      renderRepsWeightSingle(container, graph, records, graphConfig);
      break;
    case "reps-weight:multi":
      renderRepsWeightMulti(container, graph, records, graphConfig);
      break;
    default:
      container.innerHTML = `<div class="wa-error">Unknown graph type: ${renderKey}</div>`;
  }
}

function renderWeightTimeSingle(
  container: HTMLElement,
  graph: GraphInstance,
  records: SetRecord[],
  _config: GraphConfig,
): void {
  container.innerHTML = `<div class="wa-graph-placeholder">
    <strong>${graph.exerciseName}</strong> — Weight vs Time (Single)
    <br><small>${records.length} sets</small>
  </div>`;
}

function renderWeightTimeMulti(
  container: HTMLElement,
  graph: GraphInstance,
  records: SetRecord[],
  _config: GraphConfig,
): void {
  container.innerHTML = `<div class="wa-graph-placeholder">
    <strong>${graph.exerciseName}</strong> — Weight vs Time (Multi)
    <br><small>${records.length} sets</small>
  </div>`;
}

function renderRepsWeightSingle(
  container: HTMLElement,
  graph: GraphInstance,
  records: SetRecord[],
  _config: GraphConfig,
): void {
  container.innerHTML = `<div class="wa-graph-placeholder">
    <strong>${graph.exerciseName}</strong> — Reps vs Weight (Single)
    <br><small>${records.length} sets</small>
  </div>`;
}

function renderRepsWeightMulti(
  container: HTMLElement,
  graph: GraphInstance,
  records: SetRecord[],
  _config: GraphConfig,
): void {
  container.innerHTML = `<div class="wa-graph-placeholder">
    <strong>${graph.exerciseName}</strong> — Reps vs Weight (Multi)
    <br><small>${records.length} sets</small>
  </div>`;
}

/**
 * Clear a graph container.
 */
export function clearGraph(containerId: string): void {
  const container = document.querySelector(containerId) as HTMLElement | null;
  if (container) container.innerHTML = "";
}
