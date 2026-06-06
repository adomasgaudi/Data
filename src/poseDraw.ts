/**
 * Drawn (2-D) handstand-push-up figure (LIFT-DM13). A parametric, illustrated
 * side-view athlete that ACTUALLY animates the rep — elbows bend and extend on a
 * loop, the body leans, the hands sit on a block / parallettes — all driven live
 * by the variation vector (no baked timeline, so it reacts to lean / range).
 *
 * Why hand-built SVG and not Lottie/Rive/a GIF: those either play a fixed,
 * non-parametric timeline (Lottie, sprite/GIF) or need an authored asset we can't
 * produce/fetch in this build environment (Rive). A code-driven vector rig is the
 * pragmatic way to get a drawn figure that responds to the inputs. It's tiny and
 * dependency-free. The figure is shaded (gradient limbs, rounded joints, a head
 * with a facing dot) and colours the worked muscles — upper arms (deltoids /
 * triceps) blue, thighs (quads) and glutes a muscle tone.
 */
export interface PoseVec {
  support?: string;
  rom?: string;
  lean?: string;
  [k: string]: string | undefined;
}
export interface PoseDraw {
  update(vec: PoseVec): void;
  /** Hold the figure at a manual rep phase 0..1 (scrub), or null to auto-loop. */
  scrub(p: number | null): void;
  dispose(): void;
}

const NS = "http://www.w3.org/2000/svg";

/** cm string ("+15cm", "-10cm", "0cm") → metres (0.15, −0.10, 0). */
function cm(v: string | undefined): number {
  const m = /(-?\d+(?:\.\d+)?)\s*cm/.exec(v ?? "");
  return m ? parseFloat(m[1]!) / 100 : 0;
}

// Figure proportions (SVG units, y points down).
const FLOOR = 264, HANDX = 116, A = 42, ARMSPAN = 82, BODYLEN = 70, LEGLEN = 84, HEADR = 16;

interface Targets {
  phi: number;
  blockH: number;
  depth: number;
  faceDir: number;
  onWall: boolean;
  isLadder: boolean;
  deficit: boolean;
}

function readTargets(vec: PoseVec): Targets {
  const support = vec.support ?? "free";
  const isLadder = support === "ladder" || support.startsWith("lad");
  const onWall = support !== "free";
  const faceWall = support === "front_to_wall" || isLadder;
  const romM = cm(vec.rom);
  return {
    faceDir: faceWall ? -1 : 1,
    onWall,
    isLadder,
    deficit: romM < 0,
    blockH: Math.min(58, Math.abs(romM) * 150),
    depth: Math.min(0.5, Math.max(0.16, 0.34 + (romM < 0 ? 0.12 : 0) - (romM > 0 ? 0.1 : 0))),
    phi: cm(vec.lean) * 1.7,
  };
}

const f = (n: number): string => n.toFixed(1);
const OUT = "#3c4650"; // outline
/** A shaded limb: dark outline under a coloured fill, both round-capped. */
function limb(x1: number, y1: number, x2: number, y2: number, w: number, stroke: string): string {
  return (
    `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${OUT}" stroke-width="${w + 4}" stroke-linecap="round"/>` +
    `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`
  );
}

/** Build the SVG inner markup for the current eased state + rep phase p∈[0,1]. */
function build(t: Targets, p: number): string {
  const faceDir = t.faceDir;
  const handY = FLOOR - t.blockH;
  const d = Math.max(22, ARMSPAN * (1 - t.depth * p)); // shoulder height above the hands
  const Sx = HANDX, Sy = handY - d; // shoulder
  const half = d / 2;
  const e = Math.sqrt(Math.max(0, A * A - half * half)); // elbow flare from the arm chord
  const Ex = HANDX + -faceDir * e, Ey = handY - half; // elbow (flares backward)
  const bdx = -Math.sin(t.phi), bdy = -Math.cos(t.phi); // body line up, leaning to the wall
  const Px = Sx + BODYLEN * bdx, Py = Sy + BODYLEN * bdy; // hip
  const Kx = Px + LEGLEN * 0.5 * bdx, Ky = Py + LEGLEN * 0.5 * bdy; // knee
  const Fx = Px + LEGLEN * bdx, Fy = Py + LEGLEN * bdy; // feet
  // Head dives forward (in front of the hands) and down toward the floor as the
  // rep deepens — matching a real front-to-wall handstand push-up.
  const Hx = Sx + faceDir * (6 + 16 * p);
  const Hy = Math.min(FLOOR - HEADR - 2, Sy + (handY - Sy) * (0.42 + 0.32 * p));

  const GREY = "url(#lg)", BLUE = "#2f6bff", TONE = "#c2655a";
  // Scenery: wall / ladder, floor + contact shadow, block / parallettes.
  let bg = "";
  if (t.onWall) {
    bg += `<rect x="0" y="20" width="26" height="${f(FLOOR - 20)}" fill="#cdd6df"/>`;
    if (t.isLadder) for (let i = 0; i < 6; i++) bg += `<line x1="0" y1="${40 + i * 34}" x2="26" y2="${40 + i * 34}" stroke="#9fb0c3" stroke-width="4"/>`;
  }
  bg += `<ellipse cx="${HANDX}" cy="${FLOOR + 2}" rx="46" ry="7" fill="#000" opacity="0.10"/>`;
  bg += `<line x1="0" y1="${FLOOR}" x2="240" y2="${FLOOR}" stroke="#9aa3ad" stroke-width="3"/>`;
  if (t.blockH > 1) {
    if (t.deficit)
      bg += `<rect x="${HANDX - 26}" y="${f(handY)}" width="12" height="${f(t.blockH)}" fill="#9fb0c3"/><rect x="${HANDX + 14}" y="${f(handY)}" width="12" height="${f(t.blockH)}" fill="#9fb0c3"/>`;
    else bg += `<rect x="${HANDX - 26}" y="${f(handY)}" width="52" height="${f(t.blockH)}" rx="3" fill="#9fb0c3"/>`;
  }
  // Figure (back to front): legs, torso, glute, arms, hand, delt, neck, head.
  let fig = "";
  fig += limb(Px, Py, Kx, Ky, 16, TONE); // thigh = quadriceps (tone)
  fig += limb(Kx, Ky, Fx, Fy, 14, GREY); // shank
  fig += `<circle cx="${f(Fx)}" cy="${f(Fy)}" r="6" fill="${GREY}" stroke="${OUT}" stroke-width="2"/>`; // foot
  fig += limb(Sx, Sy, Px, Py, 26, GREY); // torso
  fig += `<circle cx="${f(Px - faceDir * 6)}" cy="${f(Py)}" r="11" fill="${TONE}" stroke="${OUT}" stroke-width="2"/>`; // glute
  fig += limb(Sx, Sy, Ex, Ey, 15, BLUE); // upper arm = deltoid / triceps (worked → blue)
  fig += limb(Ex, Ey, HANDX, handY, 12, GREY); // forearm
  fig += `<circle cx="${HANDX}" cy="${f(handY)}" r="6" fill="${GREY}" stroke="${OUT}" stroke-width="2"/>`; // hand
  fig += `<circle cx="${f(Sx)}" cy="${f(Sy)}" r="10" fill="${BLUE}" stroke="${OUT}" stroke-width="2"/>`; // deltoid cap
  fig += limb(Sx, Sy, Hx, Hy, 9, GREY); // neck
  fig += `<circle cx="${f(Hx)}" cy="${f(Hy)}" r="${HEADR}" fill="url(#hg)" stroke="${OUT}" stroke-width="2"/>`; // head
  fig += `<circle cx="${f(Hx + faceDir * 8)}" cy="${f(Hy + 2)}" r="2.4" fill="${OUT}"/>`; // nose (facing)

  const defs =
    `<defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8dee5"/><stop offset="1" stop-color="#aab3bd"/></linearGradient>` +
    `<radialGradient id="hg" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#dde3ea"/><stop offset="1" stop-color="#aeb7c1"/></radialGradient></defs>`;
  return defs + bg + fig;
}

export function mountPoseDraw(container: HTMLElement, initial: PoseVec): PoseDraw {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 240 300");
  svg.setAttribute("width", "100%");
  svg.classList.add("pose-draw-svg");
  container.appendChild(svg);

  let target = readTargets(initial);
  const anim = { phi: target.phi, blockH: target.blockH, depth: target.depth };
  const start = performance.now();
  let raf = 0;
  let disposed = false;
  let scrubP: number | null = null; // when set, the rep is held at this phase (slider)

  const frame = (now: number): void => {
    if (disposed) return;
    // Ease the changeable params toward their targets (smooth "movement" on edits).
    anim.phi += (target.phi - anim.phi) * 0.15;
    anim.blockH += (target.blockH - anim.blockH) * 0.15;
    anim.depth += (target.depth - anim.depth) * 0.15;
    // Scrubbed → hold the manual phase; otherwise loop the rep (~2.4 s).
    const p = scrubP != null ? scrubP : 0.5 - 0.5 * Math.cos((now - start) * ((Math.PI * 2) / 2400));
    svg.innerHTML = build({ ...target, phi: anim.phi, blockH: anim.blockH, depth: anim.depth }, p);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    update(vec: PoseVec) {
      const next = readTargets(vec);
      // keep eased fields tweening; copy discrete fields immediately
      target = next;
    },
    scrub(p: number | null) {
      scrubP = p == null ? null : Math.min(1, Math.max(0, p));
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      svg.remove();
    },
  };
}
