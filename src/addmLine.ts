/** SSOT HTML for the add-set / edit-set weight×reps column.
 *  The gray combined ×multiplier (.addm-tag-total) always sits UNDER the weight+reps
 *  row — never as a sibling to the left (owner, UI-77 / global sweep). */

/** Weight + reps inputs with the read-only combined × readout stacked below. */
export function addmWeightRepsColumnHtml(): string {
  return (
    `<div class="addm-wr-col">` +
    `<div class="addm-wr-row">` +
    `<span class="wo-af-sidelbl wo-af-sidelbl-r" title="Right side" hidden>R</span>` +
    `<input class="wo-af-weight" type="number" step="0.5" inputmode="decimal" placeholder="W" aria-label="Weight (kg)" />` +
    `<input class="wo-af-reps" type="number" step="1" min="1" inputmode="numeric" placeholder="reps" aria-label="Reps" />` +
    `</div>` +
    `<span class="addm-tag-total muted" aria-hidden="true" hidden></span>` +
    `</div>`
  );
}

/** Machine-base prefix + weight column — prefix stays LEFT of the boxes; × stays UNDER them. */
export function addmWeightRepsBlockHtml(): string {
  return (
    `<div class="addm-wr-block">` +
    `<span class="wo-af-wpre" aria-hidden="true" hidden></span>` +
    addmWeightRepsColumnHtml() +
    `</div>`
  );
}

/** One add-set line's weight×reps chip (right side of .addm-line). */
export function addmSetChipHtml(): string {
  return (
    `<div class="addm-set-chip">` +
    addmWeightRepsBlockHtml() +
    // Unilateral: a second weight×reps pair for the LEFT side.
    `<span class="wo-af-lside" hidden>` +
    `<span class="wo-af-sidelbl" title="Left side">L</span>` +
    `<input class="wo-af-weight-l" type="number" step="0.5" inputmode="decimal" placeholder="W" aria-label="Left weight (kg)" />` +
    `<input class="wo-af-reps-l" type="number" step="1" min="1" inputmode="numeric" placeholder="reps" aria-label="Left reps" />` +
    `</span>` +
    `<span class="addm-real" aria-hidden="true" hidden></span>` +
    `</div>`
  );
}
