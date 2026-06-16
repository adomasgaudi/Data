import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  cycleGraphType,
  cycleGraphViewMode,
  renderGraphControls,
  attachCustomizationListeners,
} from "./graphCustomization";
import type { GraphInstance } from "./graphLayout";

describe("graphCustomization", () => {
  describe("cycleGraphType", () => {
    it("cycles from weight-time to reps-weight", () => {
      const graph: GraphInstance = {
        id: "g1",
        exerciseName: "Squat",
        type: "weight-time",
        viewMode: "single",
      };

      const cycled = cycleGraphType(graph);

      expect(cycled.type).toBe("reps-weight");
      expect(cycled.exerciseName).toBe("Squat");
      expect(cycled.viewMode).toBe("single");
    });

    it("cycles from reps-weight to weight-time", () => {
      const graph: GraphInstance = {
        id: "g1",
        exerciseName: "Squat",
        type: "reps-weight",
        viewMode: "multi",
      };

      const cycled = cycleGraphType(graph);

      expect(cycled.type).toBe("weight-time");
      expect(cycled.viewMode).toBe("multi");
    });

    it("returns a new object (immutable)", () => {
      const graph: GraphInstance = {
        id: "g1",
        exerciseName: "Squat",
        type: "weight-time",
        viewMode: "single",
      };

      const cycled = cycleGraphType(graph);

      expect(cycled).not.toBe(graph);
      expect(graph.type).toBe("weight-time"); // original unchanged
    });
  });

  describe("cycleGraphViewMode", () => {
    it("cycles from single to multi", () => {
      const graph: GraphInstance = {
        id: "g1",
        exerciseName: "Squat",
        type: "weight-time",
        viewMode: "single",
      };

      const cycled = cycleGraphViewMode(graph);

      expect(cycled.viewMode).toBe("multi");
      expect(cycled.type).toBe("weight-time");
    });

    it("cycles from multi to single", () => {
      const graph: GraphInstance = {
        id: "g1",
        exerciseName: "Squat",
        type: "reps-weight",
        viewMode: "multi",
      };

      const cycled = cycleGraphViewMode(graph);

      expect(cycled.viewMode).toBe("single");
    });
  });

  describe("renderGraphControls", () => {
    it("renders toggle buttons with correct labels", () => {
      const graph: GraphInstance = {
        id: "g1",
        exerciseName: "Squat",
        type: "weight-time",
        viewMode: "single",
      };

      const html = renderGraphControls(graph);

      expect(html).toContain("wa-graph-controls");
      expect(html).toContain("data-graph-id=\"g1\"");
      expect(html).toContain("Weight/Time ⇄ Reps/Weight");
      expect(html).toContain("Single ⇄ Multi");
    });

    it("shows correct toggle text for reps-weight multi", () => {
      const graph: GraphInstance = {
        id: "g2",
        exerciseName: "Bench",
        type: "reps-weight",
        viewMode: "multi",
      };

      const html = renderGraphControls(graph);

      expect(html).toContain("Reps/Weight ⇄ Weight/Time");
      expect(html).toContain("Multi ⇄ Single");
    });
  });

  describe("attachCustomizationListeners", () => {
    let container: HTMLElement;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it("attaches listeners to type toggle buttons", () => {
      const graph: GraphInstance = {
        id: "g1",
        exerciseName: "Squat",
        type: "weight-time",
        viewMode: "single",
      };

      container.innerHTML = renderGraphControls(graph);
      const onTypeChange = vi.fn();

      attachCustomizationListeners(container, onTypeChange);

      const typeBtn = container.querySelector(".wa-toggle-type") as HTMLButtonElement;
      typeBtn.click();

      expect(onTypeChange).toHaveBeenCalledWith("g1");
    });

    it("attaches listeners to viewMode toggle buttons", () => {
      const graph: GraphInstance = {
        id: "g2",
        exerciseName: "Bench",
        type: "reps-weight",
        viewMode: "multi",
      };

      container.innerHTML = renderGraphControls(graph);
      const onViewModeChange = vi.fn();

      attachCustomizationListeners(container, undefined, onViewModeChange);

      const viewBtn = container.querySelector(".wa-toggle-viewmode") as HTMLButtonElement;
      viewBtn.click();

      expect(onViewModeChange).toHaveBeenCalledWith("g2");
    });

    it("attaches both listeners independently", () => {
      const graph: GraphInstance = {
        id: "g3",
        exerciseName: "Squat",
        type: "weight-time",
        viewMode: "single",
      };

      container.innerHTML = renderGraphControls(graph);
      const onTypeChange = vi.fn();
      const onViewModeChange = vi.fn();

      attachCustomizationListeners(container, onTypeChange, onViewModeChange);

      const typeBtn = container.querySelector(".wa-toggle-type") as HTMLButtonElement;
      const viewBtn = container.querySelector(".wa-toggle-viewmode") as HTMLButtonElement;

      typeBtn.click();
      viewBtn.click();

      expect(onTypeChange).toHaveBeenCalledTimes(1);
      expect(onViewModeChange).toHaveBeenCalledTimes(1);
    });
  });
});
