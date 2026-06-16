import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderCarousel, initCarouselListeners } from "./graphCarousel";
import type { CarouselGroup, GraphInstance } from "./graphLayout";

describe("graphCarousel", () => {
  describe("renderCarousel", () => {
    it("returns empty string for empty graphs list", () => {
      const html = renderCarousel("carousel-1", []);
      expect(html).toBe("");
    });

    it("renders a carousel with one graph", () => {
      const graphs: GraphInstance[] = [
        {
          id: "graph-1",
          exerciseName: "Squat",
          type: "weight-time",
          viewMode: "single",
        },
      ];

      const html = renderCarousel("carousel-1", graphs);

      expect(html).toContain("wa-carousel");
      expect(html).toContain("data-carousel-id=\"carousel-1\"");
      expect(html).toContain("Squat");
      expect(html).toContain("Weight/Time");
      expect(html).toContain("Single");
    });

    it("renders a carousel with multiple graphs", () => {
      const graphs: GraphInstance[] = [
        { id: "g1", exerciseName: "Squat", type: "weight-time", viewMode: "single" },
        { id: "g2", exerciseName: "Bench", type: "reps-weight", viewMode: "multi" },
        { id: "g3", exerciseName: "Deadlift", type: "weight-time", viewMode: "multi" },
      ];

      const html = renderCarousel("carousel-main", graphs);

      expect(html).toContain("Squat");
      expect(html).toContain("Bench");
      expect(html).toContain("Deadlift");
      expect(html).toContain("Weight/Time");
      expect(html).toContain("Reps/Weight");
      expect(html.match(/wa-graph-shell/g)?.length).toBe(3);
    });

    it("shows correct badges for each graph's type and viewMode", () => {
      const graphs: GraphInstance[] = [
        { id: "g1", exerciseName: "Squat", type: "weight-time", viewMode: "single" },
        { id: "g2", exerciseName: "Bench", type: "reps-weight", viewMode: "multi" },
      ];

      const html = renderCarousel("carousel", graphs);

      // Squat should have weight-time single
      const squatSection = html.substring(
        html.indexOf("Squat"),
        html.indexOf("Squat") + 200,
      );
      expect(squatSection).toContain("Weight/Time");
      expect(squatSection).toContain("Single");

      // Bench should have reps-weight multi
      const benchSection = html.substring(html.indexOf("Bench"));
      expect(benchSection).toContain("Reps/Weight");
      expect(benchSection).toContain("Multi");
    });

    it("includes left and right arrow buttons", () => {
      const graphs: GraphInstance[] = [
        { id: "g1", exerciseName: "Test", type: "weight-time", viewMode: "single" },
      ];

      const html = renderCarousel("carousel", graphs);

      expect(html).toContain("wa-carousel-arrow-left");
      expect(html).toContain("wa-carousel-arrow-right");
      expect(html).toContain("←");
      expect(html).toContain("→");
    });
  });

  describe("initCarouselListeners", () => {
    let container: HTMLElement;

    beforeEach(() => {
      // Create a mock carousel DOM structure
      container = document.createElement("div");
      container.innerHTML = `
        <div class="wa-carousel">
          <button class="wa-carousel-arrow wa-carousel-arrow-left">←</button>
          <div class="wa-carousel-scroll" style="width: 300px; overflow-x: auto;">
            <div class="wa-carousel-inner" style="width: 1000px; display: flex;">
              <div class="wa-graph-shell" style="width: 250px; flex-shrink: 0;">Graph 1</div>
              <div class="wa-graph-shell" style="width: 250px; flex-shrink: 0;">Graph 2</div>
            </div>
          </div>
          <button class="wa-carousel-arrow wa-carousel-arrow-right">→</button>
        </div>
      `;
    });

    it("initializes without error", () => {
      const carousel: CarouselGroup = { id: "c1", graphs: [] };
      expect(() => {
        initCarouselListeners(container, carousel);
      }).not.toThrow();
    });

    it("disables left button when at scroll start", () => {
      const carousel: CarouselGroup = { id: "c1", graphs: [] };
      const carousel_el = container.querySelector(".wa-carousel") as HTMLElement;

      initCarouselListeners(carousel_el, carousel);

      const leftBtn = container.querySelector(".wa-carousel-arrow-left") as HTMLButtonElement;
      expect(leftBtn.disabled).toBe(true);
    });

    it("accepts an onScroll callback parameter", () => {
      const carousel: CarouselGroup = { id: "c1", graphs: [] };
      const carousel_el = container.querySelector(".wa-carousel") as HTMLElement;
      const onScroll = vi.fn();

      expect(() => {
        initCarouselListeners(carousel_el, carousel, onScroll);
      }).not.toThrow();
    });

    it("restores saved scroll position", () => {
      const carousel: CarouselGroup = { id: "c1", graphs: [], scrollOffset: 100 };
      const carousel_el = container.querySelector(".wa-carousel") as HTMLElement;
      const scrollBox = carousel_el.querySelector(".wa-carousel-scroll") as HTMLElement;

      initCarouselListeners(carousel_el, carousel);

      expect(scrollBox.scrollLeft).toBe(100);
    });
  });
});
