import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderUnifiedGraph, clearGraph } from "./unifiedGraph";
import { DEFAULT_GRAPH_CONFIG } from "./graphConfig";
import type { GraphInstance } from "./graphLayout";
import type { SetRecord } from "./domain";

describe("unifiedGraph", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.id = "test-container";
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe("renderUnifiedGraph", () => {
    const mockRecords: SetRecord[] = [
      {
        username: "test",
        user: "test",
        exerciseName: "Squat",
        date: "2026-01-01",
        weight: 100,
        reps: 5,
        setNumber: 1,
        bodyweight: 80,
      } as SetRecord,
      {
        username: "test",
        user: "test",
        exerciseName: "Squat",
        date: "2026-01-02",
        weight: 105,
        reps: 5,
        setNumber: 1,
        bodyweight: 80,
      } as SetRecord,
    ];

    it("renders weight-time single view", () => {
      const graph: GraphInstance = {
        id: "g1",
        exerciseName: "Squat",
        type: "weight-time",
        viewMode: "single",
      };

      renderUnifiedGraph({
        graph,
        records: mockRecords,
        graphConfig: DEFAULT_GRAPH_CONFIG,
        containerId: "#test-container",
      });

      const content = container.textContent;
      expect(content).toContain("Squat");
      expect(content).toContain("Weight vs Time");
      expect(content).toContain("Single");
      expect(content).toContain("2 sets");
    });

    it("renders weight-time multi view", () => {
      const graph: GraphInstance = {
        id: "g2",
        exerciseName: "Bench Press",
        type: "weight-time",
        viewMode: "multi",
      };

      renderUnifiedGraph({
        graph,
        records: mockRecords,
        graphConfig: DEFAULT_GRAPH_CONFIG,
        containerId: "#test-container",
      });

      const content = container.textContent;
      expect(content).toContain("Bench Press");
      expect(content).toContain("Weight vs Time");
      expect(content).toContain("Multi");
    });

    it("renders reps-weight single view", () => {
      const graph: GraphInstance = {
        id: "g3",
        exerciseName: "Deadlift",
        type: "reps-weight",
        viewMode: "single",
      };

      renderUnifiedGraph({
        graph,
        records: mockRecords,
        graphConfig: DEFAULT_GRAPH_CONFIG,
        containerId: "#test-container",
      });

      const content = container.textContent;
      expect(content).toContain("Deadlift");
      expect(content).toContain("Reps vs Weight");
      expect(content).toContain("Single");
    });

    it("renders reps-weight multi view", () => {
      const graph: GraphInstance = {
        id: "g4",
        exerciseName: "Pull Up",
        type: "reps-weight",
        viewMode: "multi",
      };

      renderUnifiedGraph({
        graph,
        records: mockRecords,
        graphConfig: DEFAULT_GRAPH_CONFIG,
        containerId: "#test-container",
      });

      const content = container.textContent;
      expect(content).toContain("Pull Up");
      expect(content).toContain("Reps vs Weight");
      expect(content).toContain("Multi");
    });

    it("handles non-existent container gracefully", () => {
      const graph: GraphInstance = {
        id: "g1",
        exerciseName: "Squat",
        type: "weight-time",
        viewMode: "single",
      };

      expect(() => {
        renderUnifiedGraph({
          graph,
          records: mockRecords,
          graphConfig: DEFAULT_GRAPH_CONFIG,
          containerId: "#nonexistent",
        });
      }).not.toThrow();
    });

    it("shows error for unknown graph type", () => {
      const graph: GraphInstance = {
        id: "g1",
        exerciseName: "Squat",
        type: "weight-time" as any,
        viewMode: "single" as any,
      };
      // Manually change to invalid value for testing
      (graph as any).type = "invalid-type";

      renderUnifiedGraph({
        graph,
        records: mockRecords,
        graphConfig: DEFAULT_GRAPH_CONFIG,
        containerId: "#test-container",
      });

      expect(container.textContent).toContain("Unknown graph type");
    });
  });

  describe("clearGraph", () => {
    it("clears a graph container", () => {
      container.innerHTML = "<p>Some content</p>";
      expect(container.innerHTML).toContain("Some content");

      clearGraph("#test-container");

      expect(container.innerHTML).toBe("");
    });

    it("handles non-existent container gracefully", () => {
      expect(() => {
        clearGraph("#nonexistent");
      }).not.toThrow();
    });
  });
});
