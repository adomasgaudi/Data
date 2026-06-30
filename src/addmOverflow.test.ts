// @vitest-environment happy-dom
/** PB-53 layout guard: the passive tag palette must not force the add-set card wider than its cap. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";

const VW = 522;

function pill(label: string): string {
  return `<span class="addm-tag"><button type="button" class="addm-passive-pill">${label}</button><button type="button" class="addm-tag-info">ⓘ</button></span>`;
}

/** Many wide pills (~565px of nowrap content) like Handstand Push Ups on a phone. */
function widePaletteHtml(): string {
  const labels = [
    "＋ SHOULDER GAP", "＋ FOREARM SUPPORT", "＋ TEMPO", "＋ GRIP", "＋ STANCE",
    "＋ BAND", "＋ HEIGHT", "＋ WIDTH", "＋ ANGLE", "＋ SUPPORT", "＋ ROM",
  ];
  const passive = labels.map(pill).join("");
  const active = pill("✓ SUPPORT") + pill("✓ ROM");
  return (
    `<div class="addm-passive" aria-label="Tags">` +
    `<div class="addm-passive-grp"><span class="addm-passive-lbl muted">add tag</span><div class="addm-passive-pills">${passive}<button type="button" class="addm-newtag">＋ new tag</button></div></div>` +
    `<div class="addm-passive-grp"><span class="addm-passive-lbl muted">active</span><div class="addm-passive-pills">${active}</div></div>` +
    `</div>`
  );
}

function mountAddModal(): HTMLElement {
  document.body.innerHTML =
    `<div class="addm-overlay">` +
    `<div class="addm-card" role="dialog">` +
    `<div class="addm-head"><span class="addm-title">Add set</span></div>` +
    `<span class="wo-addform wo-addform--modal" data-addex="Handstand Push Ups">` +
    `<div class="addm-passive-slot">${widePaletteHtml()}</div>` +
    `<div class="addm-lines"><div class="addm-line"><div class="addm-line-vars"></div><div class="addm-line-main"><input class="wo-af-weight" value="0" /><input class="wo-af-reps" value="6" /></div></div></div>` +
    `<div class="addm-field"><span class="addm-flbl">Note</span><input class="wo-af-note" placeholder="optional note" /></div>` +
    `<div class="addm-actions"><button type="button" class="wo-af-go">Add</button></div>` +
    `</span></div></div>`;
  return document.querySelector<HTMLElement>(".addm-overlay")!;
}

function overflowHits(card: HTMLElement): string[] {
  const cardR = card.getBoundingClientRect();
  const hits: string[] = [];
  card.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const overCard = Math.round(r.right - cardR.right);
    if (overCard > 1 || r.left < cardR.left - 1) {
      const cls = el.className ? `.${String(el.className).trim().split(/\s+/).join(".")}` : el.tagName;
      hits.push(`${cls} w=${Math.round(r.width)} overCard=${overCard}`);
    }
  });
  return hits;
}

describe("PB-53 add-set modal horizontal overflow", () => {
  beforeAll(() => {
    const css = readFileSync(resolve(import.meta.dirname, "styles.css"), "utf8");
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  });

  it("keeps palette + note + Add inside the card at ~520px viewport", () => {
    Object.defineProperty(window, "innerWidth", { value: VW, configurable: true });
    document.documentElement.style.width = `${VW}px`;
    const wrap = mountAddModal();
    const card = wrap.querySelector<HTMLElement>(".addm-card")!;
    const cardW = card.getBoundingClientRect().width;
    expect(cardW).toBeLessThanOrEqual(VW);

    const slot = wrap.querySelector<HTMLElement>(".addm-passive-slot")!;
    const note = wrap.querySelector<HTMLElement>(".wo-af-note")!;
    const addBtn = wrap.querySelector<HTMLElement>(".wo-af-go")!;
    const slotR = slot.getBoundingClientRect();
    const cardR = card.getBoundingClientRect();

    expect(slotR.width).toBeLessThanOrEqual(cardR.width + 1);
    expect(slotR.right).toBeLessThanOrEqual(cardR.right + 1);
    expect(note.getBoundingClientRect().right).toBeLessThanOrEqual(cardR.right + 1);
    expect(addBtn.getBoundingClientRect().right).toBeLessThanOrEqual(cardR.right + 1);

    const hits = overflowHits(card);
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
