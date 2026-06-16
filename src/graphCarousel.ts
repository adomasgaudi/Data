/**
 * Graph carousel rendering (Part 4 of refactor).
 * Renders a horizontal scrollable carousel of graph instances.
 * Each graph in the carousel can be customized independently.
 */

import type { CarouselGroup, GraphInstance } from "./graphLayout";

/**
 * HTML for a single graph shell in the carousel.
 * This is just the container; actual graph rendering happens separately.
 * @param graph The graph instance
 * @returns HTML string for the graph card/shell
 */
function renderGraphShell(graph: GraphInstance): string {
  return `<div class="wa-graph-shell" data-graph-id="${graph.id}">
    <div class="wa-graph-header">
      <span class="wa-graph-exercise">${graph.exerciseName}</span>
      <div class="wa-graph-badges">
        <span class="wa-badge" data-type="weight-time">${graph.type === "weight-time" ? "Weight/Time" : "Reps/Weight"}</span>
        <span class="wa-badge" data-view="${graph.viewMode}">${graph.viewMode === "single" ? "Single" : "Multi"}</span>
      </div>
    </div>
    <div class="wa-graph-content"></div>
  </div>`;
}

/**
 * HTML for the carousel container with left/right arrow buttons.
 * @param carouselId The carousel's unique ID
 * @param graphs The graphs to render
 * @returns HTML string for the carousel
 */
export function renderCarousel(carouselId: string, graphs: readonly GraphInstance[]): string {
  if (graphs.length === 0) return "";

  const graphShells = graphs.map((g) => renderGraphShell(g)).join("");

  return `<div class="wa-carousel" data-carousel-id="${carouselId}">
    <button class="wa-carousel-arrow wa-carousel-arrow-left" aria-label="Scroll left" title="Previous graph">←</button>
    <div class="wa-carousel-scroll">
      <div class="wa-carousel-inner">
        ${graphShells}
      </div>
    </div>
    <button class="wa-carousel-arrow wa-carousel-arrow-right" aria-label="Scroll right" title="Next graph">→</button>
  </div>`;
}

/**
 * Initialize carousel scroll listeners on a carousel element.
 * @param container The carousel container element
 * @param carouselGroup The CarouselGroup (for scroll state tracking)
 * @param onScroll Optional callback when carousel scrolls
 */
export function initCarouselListeners(
  container: HTMLElement,
  carouselGroup: CarouselGroup,
  onScroll?: (offset: number) => void,
): void {
  const scrollBox = container.querySelector(".wa-carousel-scroll") as HTMLElement | null;
  const leftBtn = container.querySelector(".wa-carousel-arrow-left") as HTMLButtonElement | null;
  const rightBtn = container.querySelector(".wa-carousel-arrow-right") as HTMLButtonElement | null;

  if (!scrollBox || !leftBtn || !rightBtn) return;

  const scrollAmount = 300; // pixels to scroll per arrow click

  const updateArrows = () => {
    const atStart = scrollBox.scrollLeft <= 0;
    const atEnd = scrollBox.scrollLeft >= scrollBox.scrollWidth - scrollBox.clientWidth - 1;
    leftBtn.disabled = atStart;
    rightBtn.disabled = atEnd;
  };

  const emitScroll = () => {
    if (onScroll) onScroll(scrollBox.scrollLeft);
  };

  leftBtn.addEventListener("click", () => {
    scrollBox.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    setTimeout(updateArrows, 50);
    emitScroll();
  });

  rightBtn.addEventListener("click", () => {
    scrollBox.scrollBy({ left: scrollAmount, behavior: "smooth" });
    setTimeout(updateArrows, 50);
    emitScroll();
  });

  scrollBox.addEventListener("scroll", () => {
    updateArrows();
    emitScroll();
  });

  // Restore scroll position if saved
  if (carouselGroup.scrollOffset) {
    scrollBox.scrollLeft = carouselGroup.scrollOffset;
  }

  updateArrows();
}
