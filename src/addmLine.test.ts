// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { addmSetChipHtml, addmWeightRepsBlockHtml, addmWeightRepsColumnHtml } from "./addmLine";

function parse(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
}

describe("addmLine weight×reps SSOT", () => {
  beforeAll(() => {
    const css = readFileSync(resolve(import.meta.dirname, "styles.css"), "utf8");
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  });

  it("places .addm-tag-total under .addm-wr-row inside .addm-wr-col (not left of weight)", () => {
    const root = parse(addmWeightRepsColumnHtml());
    const col = root.querySelector(".addm-wr-col")!;
    const row = root.querySelector(".addm-wr-row")!;
    const total = root.querySelector(".addm-tag-total")!;
    const weight = root.querySelector(".wo-af-weight")!;

    expect(col.contains(row)).toBe(true);
    expect(col.contains(total)).toBe(true);
    expect(col.contains(weight)).toBe(true);
    expect(row.contains(weight)).toBe(true);
    expect(row.contains(total)).toBe(false);
    expect(col.querySelector(":scope > .addm-wr-row + .addm-tag-total")).toBe(total);
    expect(root.querySelector(".addm-set-chip > .addm-tag-total")).toBeNull();
  });

  it("keeps machine prefix outside the column so × centers under W/reps only", () => {
    const root = parse(addmWeightRepsBlockHtml());
    const block = root.querySelector(".addm-wr-block")!;
    const pre = root.querySelector(".wo-af-wpre")!;
    const col = root.querySelector(".addm-wr-col")!;

    expect(block.contains(pre)).toBe(true);
    expect(block.contains(col)).toBe(true);
    expect(col.contains(pre)).toBe(false);
    expect(block.querySelector(":scope > .wo-af-wpre + .addm-wr-col")).toBe(col);
  });

  it("set chip uses the block wrapper globally (add + edit paths share afLine)", () => {
    const root = parse(addmSetChipHtml());
    expect(root.querySelector(".addm-wr-block .addm-tag-total")).not.toBeNull();
    expect(root.querySelector(".addm-set-chip > .addm-tag-total")).toBeNull();
  });

  it("stacks × below weight+reps in layout (column flex, not beside)", () => {
    document.body.innerHTML = `<div class="addm-line-main">${addmSetChipHtml()}</div>`;
    const col = document.querySelector<HTMLElement>(".addm-wr-col")!;
    const row = document.querySelector<HTMLElement>(".addm-wr-row")!;
    const total = document.querySelector<HTMLElement>(".addm-tag-total")!;
    total.textContent = "×0.82";
    total.removeAttribute("hidden");

    const colStyle = getComputedStyle(col);
    expect(colStyle.flexDirection).toBe("column");

    const rowRect = row.getBoundingClientRect();
    const totalRect = total.getBoundingClientRect();
    expect(totalRect.top).toBeGreaterThanOrEqual(rowRect.bottom - 1);
    expect(totalRect.left).toBeGreaterThan(rowRect.left - 2);
    expect(totalRect.right).toBeLessThan(rowRect.right + 2);
  });
});
