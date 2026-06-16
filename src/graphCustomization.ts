/**
 * Graph Customization Controls (Part 6 of refactor).
 * Per-graph toggles for type (weight-time | reps-weight) and viewMode (single | multi).
 */

import type { GraphInstance } from "./graphLayout";

/**
 * Cycle a graph's type between weight-time and reps-weight.
 */
export function cycleGraphType(graph: GraphInstance): GraphInstance {
  return {
    ...graph,
    type: graph.type === "weight-time" ? "reps-weight" : "weight-time",
  };
}

/**
 * Cycle a graph's viewMode between single and multi.
 */
export function cycleGraphViewMode(graph: GraphInstance): GraphInstance {
  return {
    ...graph,
    viewMode: graph.viewMode === "single" ? "multi" : "single",
  };
}

/**
 * Render customization toggle buttons for a graph.
 * Two cycling pills: one for type, one for viewMode.
 */
export function renderGraphControls(graph: GraphInstance): string {
  return `<div class="wa-graph-controls">
    <button class="wa-control-toggle wa-toggle-type" data-graph-id="${graph.id}" title="Switch between weight-time and reps-weight">
      ${graph.type === "weight-time" ? "Weight/Time ⇄ Reps/Weight" : "Reps/Weight ⇄ Weight/Time"}
    </button>
    <button class="wa-control-toggle wa-toggle-viewmode" data-graph-id="${graph.id}" title="Switch between single and multi view">
      ${graph.viewMode === "single" ? "Single ⇄ Multi" : "Multi ⇄ Single"}
    </button>
  </div>`;
}

/**
 * Attach event listeners to customization buttons.
 * @param container The element containing the controls
 * @param onTypeChange Callback when type is toggled
 * @param onViewModeChange Callback when viewMode is toggled
 */
export function attachCustomizationListeners(
  container: HTMLElement,
  onTypeChange?: (graphId: string) => void,
  onViewModeChange?: (graphId: string) => void,
): void {
  container.querySelectorAll(".wa-toggle-type").forEach((btn) => {
    btn.addEventListener("click", () => {
      const graphId = (btn as HTMLElement).getAttribute("data-graph-id");
      if (graphId && onTypeChange) onTypeChange(graphId);
    });
  });

  container.querySelectorAll(".wa-toggle-viewmode").forEach((btn) => {
    btn.addEventListener("click", () => {
      const graphId = (btn as HTMLElement).getAttribute("data-graph-id");
      if (graphId && onViewModeChange) onViewModeChange(graphId);
    });
  });
}
