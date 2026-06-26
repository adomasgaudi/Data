/**
 * EDITABLE CONFIG for the factored variation-difficulty model (LIFT-DM1).
 *
 * The same logical exercise (a "family") is done in many variations that are only
 * captured as free-text notes. This config turns those notes into a structured
 * attribute vector: each family has DIMENSIONS (e.g. support, range of motion),
 * each with named LEVELS and a difficulty factor; and a TOKEN table mapping the
 * messy note phrases to one-or-more dimension assignments (a token can IMPLY
 * several attributes — "yoga block" sets the range AND that it's against a wall).
 *
 * The resolver in variationModel.ts is PURE and takes this config as input, so
 * everything here is data the owner calibrates — the numbers are placeholders.
 * Nothing in the resolver hardcodes these names.
 *
 * `CONFIG_VERSION` is bumped whenever this file changes, so any memoised resolve
 * can be invalidated on `(note, CONFIG_VERSION)` (see variationModel.ts).
 */

/** A dimension's levels → difficulty factor (×1 = reference, <1 easier). */
export type Levels = Record<string, number>;
export interface FamilyDef {
  /** dimension name → its levels (level → factor). */
  dims: Record<string, Levels>;
  /** dimension name → the level assumed when no token sets it (inheritance). */
  defaults: Record<string, string>;
}
/** A token's assignments: dimension → level, plus an optional numeric `priority`
 * (higher wins / is applied last when two tokens touch the same dimension). */
export type TokenDef = Record<string, string | number>;
export interface VariationConfig {
  FAMILIES: Record<string, FamilyDef>;
  TOKENS: Record<string, Record<string, TokenDef>>;
}

// Handstand push-up model, derived from the real logged notes. DIMENSIONS are the
// independent ways the lift is made easier/harder; LEVELS each carry a placeholder
// difficulty factor (×1 = the hardest/reference, <1 easier, >1 harder) for the
// owner to calibrate. Vertical depth in centimetres ("15cm", "+3cm") is NOT here —
// it's already captured as a per-set cm LEVEL by the squat-rack/cm system upstream.
export const FAMILIES: Record<string, FamilyDef> = {
  HSPU: {
    dims: {
      // SUPPORT — the wall orientation / overall setup, picked from a dropdown:
      // free (freestanding, ×1 reference), front-to-wall, back-to-wall, or LADDER.
      // The ladder setup then adds two sub-choices below (its own dimensions):
      // a leg GRIP (l-sit / hooked) and a rung HEIGHT — each a separate multiplier
      // that combines with the ladder base. Calibrate the numbers.
      support: {
        free: 1.0,
        front_to_wall: 0.92,
        back_to_wall: 0.82,
        ladder: 0.55,
      },
      // Ladder leg grip (only applies on the ladder). l-sit = legs out front (harder),
      // hooked = legs hooked on a rung (assisted, easier). none = neither.
      ladderGrip: { none: 1.0, lsit: 0.8, hooked: 0.5 },
      // Ladder rung height — how high your feet are (higher rung = more assist =
      // easier). none = unspecified. lad3 lowest … lad9 highest.
      ladderH: { none: 1.0, lad3: 0.72, lad5: 0.6, lad6: 0.55, lad9: 0.42 },
      // Assistance band ("guma") by its NUMBER (1–6). HIGHER number = heavier band =
      // MORE help = lower factor; lower number = lighter = less help. Calibrate.
      band: { none: 1.0, "1": 0.92, "2": 0.85, "3": 0.75, "4": 0.62, "5": 0.56, "6": 0.5 },
      // Range of motion measured as the hand height vs the floor, in cm. 0cm = to
      // the floor (full depth, the ×1 reference); a block/raised hands (+cm) shortens
      // the range → easier (<1); parallettes/brick go below the floor (−cm) → deeper,
      // harder (>1). A yoga block reads as +5 / +15 / +23cm depending on its side.
      rom: { "+25cm": 0.56, "+23cm": 0.6, "+20cm": 0.66, "+15cm": 0.72, "+10cm": 0.8, "+5cm": 0.88, "+2cm": 0.94, "0cm": 1.0, "-3cm": 1.06, "-5cm": 1.1, "-10cm": 1.22, "-15cm": 1.35, "-20cm": 1.5 },
      // Forward lean, in cm. This BASE table is the IMMEDIATE one (free / front-to-
      // wall / banded): lean gets harder from the first cm, ~×1.0 → ×1.2 over 0–23cm.
      // Back-to-wall gets a 15cm "grace" applied in code (the scale shifted down
      // 15cm), so against the wall the first 15cm of lean does nothing.
      lean: { "0cm": 1.0, "3cm": 1.03, "5cm": 1.04, "8cm": 1.07, "10cm": 1.09, "13cm": 1.11, "15cm": 1.13, "18cm": 1.16, "20cm": 1.17, "23cm": 1.2 },
      // Uninterrupted (unbroken) is the DEFAULT and the ×1 reference; paused is easier.
      continuity: { paused: 0.95, uninterrupted: 1.0 },
      // Hands down: both (×1 reference) or ONE hand. A one-hand handstand push-up
      // is far harder — placeholder ×1.8 (calibrate). Used by the scapular HSPU
      // variant the owner logs "one hand" on.
      hands: { two: 1.0, one: 1.8 },
      // RANGE: a "low ROM" partial (only the short top portion — a more scapular,
      // shrug-like press) is an easier press → <1. full = the whole press (×1).
      range: { full: 1.0, low: 0.7 },
      // BACK-TO-WALL ONLY: the BACK SUPPORT — how far the shoulders/back sit OFF the
      // wall, in cm, set by what's behind you. "blue" = the 6cm blue block (a named
      // reference shown with a diagram/photo); 30cm / 45cm = a taller box/support.
      // Multipliers are NEUTRAL for now (calibrate later — likely farther = harder).
      shoulderDist: { "0cm": 1.0, blue: 1.0, "30cm": 1.0, "45cm": 1.0 },
      // FOREARM SUPPORT (owner) — resting the forearms on a block/support at this height
      // (cm) makes the handstand work easier. Neutral ×1 placeholders for now — calibrate
      // in ⚙ Difficulty multipliers (likely taller = more support = easier, <1).
      forearmSupport: { none: 1.0, "7cm": 1.0, "15cm": 1.0, "23cm": 1.0, "30cm": 1.0 },
    },
    defaults: { support: "free", ladderGrip: "none", ladderH: "none", band: "none", rom: "0cm", lean: "0cm", continuity: "uninterrupted", hands: "two", range: "full", shoulderDist: "0cm", forearmSupport: "none" },
  },
  PUSHUP: {
    // INCLINE (hands raised) is NOT a family dimension — it's how high the hands are,
    // captured per-set by the smith-notch / squat-rack / cm LEVEL system (variants.ts,
    // all converging on one cm incline) so it COMBINES with this. The one family
    // dimension is body POSITION: on the knees is easier than on the feet (floor).
    // Knees ≈ 0.7× a floor push-up (tune it in ⚙ Difficulty multipliers).
    dims: { position: { floor: 1.0, knees: 0.7 } },
    defaults: { position: "floor" },
  },
  PULLUP: {
    // Pull-ups / chin-ups. The one modelled variation is the assistance BAND ("guma"):
    // exactly like HSPU, a band removes a near-constant force, so its help is measured in
    // KILOGRAMS subtracted from the bodyweight load (see bandAssistKg / the band-knob) —
    // NOT a multiplier (band is skipped by noteVariationScale). Higher guma number =
    // heavier band = more help = more kg off. none = unassisted (×1 reference). The
    // factor values below are unused for scaling (band is kg-only); kept only so the
    // 1–6 levels exist for the picker. Tune the kg in ⚙ Difficulty multipliers → band.
    dims: {
      band: { none: 1.0, "1": 0.92, "2": 0.85, "3": 0.75, "4": 0.62, "5": 0.56, "6": 0.5 },
    },
    defaults: { band: "none" },
  },
  RCSIDEBEND: {
    // Roman-chair (45° hyperextension bench) SIDE BEND. The owner logs four variation
    // attributes per set: the bench HEIGHT notch (−1 … 8), the back-pad ANGLE (1 … 5),
    // whether it's the ADDUCTOR-focused or the FULL side bend, and the RANGE OF MOTION as
    // cm of torso drop measured from the ground (0cm = to the ground / deepest; +cm =
    // shorter range, raised, easier). All factors are PLACEHOLDERS (×1 — they CAPTURE the
    // attribute without scaling yet); calibrate the numbers in ⚙ Difficulty multipliers.
    dims: {
      height: { "-1": 1.0, "0": 1.0, "1": 1.0, "2": 1.0, "3": 1.0, "4": 1.0, "5": 1.0, "6": 1.0, "7": 1.0, "8": 1.0 },
      angle: { "1": 1.0, "2": 1.0, "3": 1.0, "4": 1.0, "5": 1.0 },
      position: { full: 1.0, adductor: 1.0 },
      rom: { "0cm": 1.0, "+5cm": 1.0, "+10cm": 1.0, "+15cm": 1.0, "+20cm": 1.0, "+25cm": 1.0, "+30cm": 1.0 },
    },
    defaults: { height: "0", angle: "1", position: "full", rom: "0cm" },
  },
  KNEERAISE: {
    dims: {
      support: { hanging: 1.0, dips_bar: 0.85 },
      backrest: { none: 1.0, "30cm": 0.9 },
      obstacle: { none: 1.0, S: 1.05, M: 1.1, L: 1.15 },
    },
    defaults: { support: "hanging", backrest: "none", obstacle: "none" },
  },
  CROSSSQUAT: {
    // Cross-legged (seated cross-leg → stand) squat. The owner's two requested
    // variables: an ASSISTANCE BAND (helps you up — heavier band = more help) and
    // (handled universally) the range of motion. Band factors are PLACEHOLDERS (×1 —
    // they capture the level without scaling yet); calibrate in ⚙ Difficulty
    // multipliers. ROM is the per-exercise universal default (90%), not a dim here.
    dims: {
      band: { none: 1.0, "1": 1.0, "2": 1.0, "3": 1.0, "4": 1.0, "5": 1.0, "6": 1.0 },
    },
    defaults: { band: "none" },
  },
  // PB-36 — without this family the handstand skill lifts had NO variation pickers
  // (only the generic ROM%); the owner "couldn't add variations for HS Wall Tap".
  HANDSTAND: {
    // The non-press handstand SKILL lifts — wall TAP (wall touch), touch-shoulders,
    // kicks, hold, walk… — share the SAME setup variations as the handstand PUSH-UP
    // (owner: "give wall tap the same variations HSPU has"), MINUS the pressing-only
    // dims (band assist, press depth in cm, low/full press range, one-/two-hand
    // press). What's left is the SETUP: wall orientation, the ladder (grip + rung
    // height), a yoga BLOCK prop (S/M/L like the knee-raise obstacle), forward lean,
    // and — back-to-wall only — shoulder distance. Support/ladder/lean factors mirror
    // HSPU's so difficulty reads consistently across all handstand work; the yoga
    // block is a neutral ×1 placeholder. Calibrate the numbers in ⚙ Difficulty
    // multipliers. No "rom" dim → the depth×lean pad is skipped (it's HSPU-press only);
    // lean shows as its own chip row, and the universal per-set ROM% covers range.
    dims: {
      support: { free: 1.0, front_to_wall: 0.92, back_to_wall: 0.82, ladder: 0.55 },
      ladderGrip: { none: 1.0, lsit: 0.8, hooked: 0.5 },
      ladderH: { none: 1.0, lad3: 0.72, lad5: 0.6, lad6: 0.55, lad9: 0.42 },
      // Yoga block used as a prop / target (S 6cm · M 15cm · L 23cm) — same obstacle
      // dim the knee-raise uses; neutral ×1 placeholders for now (calibrate).
      obstacle: { none: 1.0, S: 1.0, M: 1.0, L: 1.0 },
      lean: { "0cm": 1.0, "3cm": 1.03, "5cm": 1.04, "8cm": 1.07, "10cm": 1.09, "13cm": 1.11, "15cm": 1.13, "18cm": 1.16, "20cm": 1.17, "23cm": 1.2 },
      // BACK SUPPORT (back-to-wall) — same as HSPU: blue 6cm block, or a 30/45cm box.
      shoulderDist: { "0cm": 1.0, blue: 1.0, "30cm": 1.0, "45cm": 1.0 },
      // FOREARM SUPPORT (owner) — forearms rested on a block at this height (cm). Neutral
      // ×1 placeholders for now — calibrate in ⚙ Difficulty multipliers.
      forearmSupport: { none: 1.0, "7cm": 1.0, "15cm": 1.0, "23cm": 1.0, "30cm": 1.0 },
      // WALL-TAP CONTACT (owner) — what touches the wall × rest vs light tap. The labels /
      // hints live in handstandLean.ts (TAP_CONTACT_*); THESE are the difficulty factors
      // (the SSOT the resolver reads). More support (hips+shoulders) and resting are easier;
      // shoulders-only light-tap is the hardest reference. "none" = not a wall-tap / unset.
      tapContact: { none: 1.0, hips_rest: 0.85, sh_rest: 0.92, hips_tap: 0.97, sh_tap: 1.0 },
    },
    defaults: { support: "free", ladderGrip: "none", ladderH: "none", obstacle: "none", lean: "0cm", shoulderDist: "0cm", forearmSupport: "none", tapContact: "none" },
  },
  // The owner's "Lever" lifts (EXR-163) — an adjustable one-sided loaded handle: a
  // plate on a movable collar near one END, gripped at the other, swung like a
  // mace/axe. Its whole point is LEVERAGE, so the resistance a wrist/forearm
  // rotation feels is a TORQUE = plate mass × moment arm (the distance from the
  // wrist pivot to the plate). The owner asked for "exact torque", so the LEVER
  // factor is the moment-arm RATIO (cm ÷ a 40cm reference = ×1) — true physics, not
  // a guessed multiplier — and it scales the logged plate kg into an effective-
  // torque effort, so a 5kg plate held far out lines up against 5kg pulled in.
  // Shared by all four Lever lifts (Pronation/Supination forearm rotations +
  // Abduction/Adduction wrist deviations) — they differ only by axis, not by the knobs.
  //  • lever — plate distance from the grip, in cm (owner's "weight-distance"). EXACT
  //    moment-arm scaling: factor = cm ÷ 40. Recalibrate the reference/numbers (e.g.
  //    your real handle geometry) in ⚙ Difficulty multipliers.
  //  • reach — how far the whole arm is held out (owner's "very important" distance:
  //    forward = easier, further = harder). Arm reach changes posture/stabiliser
  //    leverage, which is NOT a clean single-measurement torque like the lever — so
  //    these are a calibratable gradient (placeholder, tune by feel), not exact.
  LEVER: {
    dims: {
      lever: { "20cm": 0.5, "30cm": 0.75, "40cm": 1.0, "50cm": 1.25, "60cm": 1.5, "70cm": 1.75 },
      reach: { tucked: 0.85, neutral: 1.0, extended: 1.15, far: 1.3 },
    },
    defaults: { lever: "40cm", reach: "neutral" },
  },
};

/** Every family that carries a given variation dimension (tag). Pure — used by the
 * tag info panel's "used by" list so it can't drift from the real config. */
export function familiesUsingDim(families: Record<string, FamilyDef>, dim: string): string[] {
  return Object.keys(families).filter((fam) => !!families[fam]!.dims[dim]);
}

/** A family's tag (dimension) list IN DISPLAY ORDER: the built-in dims it carries (kept in
 * `order`), then any USER-created dims appended (order-stable, deduped). Pure — the single source
 * for "which tags does a family show", so the palette, per-set pickers, variation editor and
 * scaling all enumerate the same set and a new tag can never appear in one place but not another. */
export function mergeDimOrder(order: string[], hasDim: (dim: string) => boolean, userDims: string[]): string[] {
  const base = order.filter(hasDim);
  const user = userDims.filter((d) => !base.includes(d));
  return [...base, ...user];
}

export const TOKENS: Record<string, Record<string, TokenDef>> = {
  HSPU: {
    // wall orientation. Bare "wall" = back-to-wall (the common one); chest/face
    // cues ("navel to wall", "close to wall") = front-to-wall. "no wall" wins.
    wall: { support: "back_to_wall" },
    "back to wall": { support: "back_to_wall", priority: 4 },
    "b2 wall": { support: "back_to_wall", priority: 4 },
    "front to wall": { support: "front_to_wall", priority: 4 },
    "navel to wall": { support: "front_to_wall", priority: 4 },
    "close to wall": { support: "front_to_wall", priority: 4 },
    ladder: { support: "ladder" },
    "no wall": { support: "free", priority: 5 },
    freestanding: { support: "free" },
    // assistance band — "guma N" by number (higher N = heavier = more help);
    // longest-match-first means "guma 5" beats "guma". Bare "guma" assumes a mid band.
    "guma 1": { band: "1" },
    "guma 2": { band: "2" },
    "guma 3": { band: "3" },
    "guma 4": { band: "4" },
    "guma 5": { band: "5" },
    "guma 6": { band: "6" },
    guma: { band: "5" },
    // range of motion in cm (a raised block shortens it; parallettes/brick deepen
    // it). A block implies you're also against the wall. The yoga side = +5/15/23cm.
    "l yoga": { rom: "+23cm", support: "back_to_wall" },
    "m yoga": { rom: "+15cm", support: "back_to_wall" },
    "yoga block": { rom: "+15cm", support: "back_to_wall" },
    yoga: { rom: "+15cm", support: "back_to_wall" },
    paraletes: { rom: "-10cm" },
    parallettes: { rom: "-10cm" },
    brick: { rom: "-5cm" },
    limited: { rom: "+5cm" },
    // legs → a ladder GRIP (and they imply the ladder setup)
    "l sit": { support: "ladder", ladderGrip: "lsit" },
    "l-sit": { support: "ladder", ladderGrip: "lsit" },
    lsit: { support: "ladder", ladderGrip: "lsit" },
    hooked: { support: "ladder", ladderGrip: "hooked" },
    "užkabintos kojos": { support: "ladder", ladderGrip: "hooked" }, // hooked legs (assisted)
    // BACK SUPPORT — the blue 6cm block, or a 30/45cm box behind the back (back-to-wall).
    blue: { support: "back_to_wall", shoulderDist: "blue" },
    "blue block": { support: "back_to_wall", shoulderDist: "blue" },
    "30cm back": { support: "back_to_wall", shoulderDist: "30cm" },
    "45cm back": { support: "back_to_wall", shoulderDist: "45cm" },
    // FOREARM SUPPORT — forearms rested on a block at this height (cm).
    "forearm 7": { forearmSupport: "7cm" },
    "forearm 15": { forearmSupport: "15cm" },
    "forearm 23": { forearmSupport: "23cm" },
    "forearm 30": { forearmSupport: "30cm" },
    // lean / continuity
    "forward lean": { lean: "15cm" },
    uninterupted: { continuity: "uninterrupted" }, // (owner's spelling)
    uninterrupted: { continuity: "uninterrupted" },
    // hands down — one-hand / one-arm (much harder). Longest-match-first handles
    // the spacings; bare "one hand" / "1 hand" / "one arm" all map to one.
    "one hand": { hands: "one" },
    "1 hand": { hands: "one" },
    "one arm": { hands: "one" },
    "1 arm": { hands: "one" },
    // low / partial RANGE of motion (the short, scapular top portion — easier press)
    "low rom": { range: "low" },
    "partial rom": { range: "low" },
    "partial": { range: "low" },
    "half rom": { range: "low" },
    "short rom": { range: "low" },
    // ladder / wall-bar rung height → ladder SUPPORT + a HEIGHT ("lad5", "9lygis", …)
    "lad3": { support: "ladder", ladderH: "lad3" },
    "lad5": { support: "ladder", ladderH: "lad5" },
    "lad6": { support: "ladder", ladderH: "lad6" },
    "6lad": { support: "ladder", ladderH: "lad6" },
    "9lygis": { support: "ladder", ladderH: "lad9" },
    "5 level": { support: "ladder", ladderH: "lad5" },
    "5 lygis": { support: "ladder", ladderH: "lad5" },
  },
  PUSHUP: {
    // On the knees (easier) → the POSITION dimension. LT "ant kelių" / "nuo kelių".
    // NB a plain "ant <number>" is an incline NOTCH (read by the level system) — only
    // "ant kelių" (on the KNEES) is this variation, so the two never collide.
    "from knees": { position: "knees" },
    "on knees": { position: "knees" },
    kneeling: { position: "knees" },
    knees: { position: "knees" },
    knee: { position: "knees" },
    "ant kelių": { position: "knees" },
    "ant keliu": { position: "knees" },
    "nuo kelių": { position: "knees" },
    "nuo keliu": { position: "knees" },
  },
  PULLUP: {
    // Assistance band ("guma") by its NUMBER (1–6) — same as HSPU. Higher = heavier band
    // = more help (more kg off). Longest-match-first means "guma 5" beats bare "guma".
    "guma 1": { band: "1" },
    "guma 2": { band: "2" },
    "guma 3": { band: "3" },
    "guma 4": { band: "4" },
    "guma 5": { band: "5" },
    "guma 6": { band: "6" },
    guma: { band: "5" },
  },
  RCSIDEBEND: {
    // Free-text note hints for the side-bend. Height/angle/ROM are usually set in the
    // per-set editor (no common note word), but the position focus shows up in notes.
    adductor: { position: "adductor" },
    adduktor: { position: "adductor" }, // LT spelling
    "full bend": { position: "full" },
    full: { position: "full" },
  },
  KNEERAISE: {
    hanging: { support: "hanging" },
    "hang bar": { support: "hanging" },
    "dips bar": { support: "dips_bar", priority: 4 },
    "dip bar": { support: "dips_bar", priority: 4 },
    dips: { support: "dips_bar" },
    lygiagretės: { support: "dips_bar" },
    lygiageretes: { support: "dips_bar" },
    "back rest": { backrest: "30cm" },
    backrest: { backrest: "30cm" },
    "back pad": { backrest: "30cm" },
    "nugaros atrama": { backrest: "30cm" },
    "l yoga": { obstacle: "L" },
    "yoga l": { obstacle: "L" },
    "yoga block l": { obstacle: "L" },
    "m yoga": { obstacle: "M" },
    "yoga m": { obstacle: "M" },
    "yoga block m": { obstacle: "M" },
    "yoga block": { obstacle: "M" },
    yoga: { obstacle: "M" },
    "s yoga": { obstacle: "S" },
    "yoga s": { obstacle: "S" },
    "yoga block s": { obstacle: "S" },
  },
  CROSSSQUAT: {
    // Assistance band by number (higher = heavier = more help). Longest-match-first
    // means "band 5" beats bare "band"/"assisted" (which assume a mid band).
    "band 1": { band: "1" },
    "band 2": { band: "2" },
    "band 3": { band: "3" },
    "band 4": { band: "4" },
    "band 5": { band: "5" },
    "band 6": { band: "6" },
    "guma 1": { band: "1" },
    "guma 2": { band: "2" },
    "guma 3": { band: "3" },
    "guma 4": { band: "4" },
    "guma 5": { band: "5" },
    "guma 6": { band: "6" },
    band: { band: "5" },
    assisted: { band: "5" },
    "band assisted": { band: "5" },
    guma: { band: "5" },
  },
  HANDSTAND: {
    // Wall orientation (same cues as HSPU). Bare "wall" = back-to-wall; "butt to wall"
    // too; chest/face cues = front-to-wall; "no wall" wins.
    wall: { support: "back_to_wall" },
    "back to wall": { support: "back_to_wall", priority: 4 },
    "butt to wall": { support: "back_to_wall", priority: 4 },
    "front to wall": { support: "front_to_wall", priority: 4 },
    "navel to wall": { support: "front_to_wall", priority: 4 },
    "close to wall": { support: "front_to_wall", priority: 4 },
    "no wall": { support: "free", priority: 5 },
    freestanding: { support: "free" },
    ladder: { support: "ladder" },
    // Yoga BLOCK prop → the obstacle dim (S/M/L). Longest-match-first means "yoga l"
    // beats bare "yoga". (Bare single letters M/L aren't tokens — too collision-prone.)
    "l yoga": { obstacle: "L" },
    "yoga l": { obstacle: "L" },
    "m yoga": { obstacle: "M" },
    "yoga m": { obstacle: "M" },
    "s yoga": { obstacle: "S" },
    "yoga s": { obstacle: "S" },
    "yoga block": { obstacle: "M" },
    yoga: { obstacle: "M" },
    // Shoulders touching the wall (back-to-wall, shoulders on it).
    "shoulders to wall": { support: "back_to_wall", shoulderDist: "0cm" },
    // BACK SUPPORT — the blue 6cm block, or a 30/45cm box behind the back (back-to-wall).
    blue: { support: "back_to_wall", shoulderDist: "blue" },
    "blue block": { support: "back_to_wall", shoulderDist: "blue" },
    "30cm back": { support: "back_to_wall", shoulderDist: "30cm" },
    "45cm back": { support: "back_to_wall", shoulderDist: "45cm" },
    // FOREARM SUPPORT — forearms rested on a block at this height (cm).
    "forearm 7": { forearmSupport: "7cm" },
    "forearm 15": { forearmSupport: "15cm" },
    "forearm 23": { forearmSupport: "23cm" },
    "forearm 30": { forearmSupport: "30cm" },
    // Forward lean.
    "forward lean": { lean: "15cm" },
    // Ladder rung height (+ the ladder support it implies).
    lad3: { support: "ladder", ladderH: "lad3" },
    lad5: { support: "ladder", ladderH: "lad5" },
    lad6: { support: "ladder", ladderH: "lad6" },
    "ladder 5": { support: "ladder", ladderH: "lad5" },
    "ladder 6": { support: "ladder", ladderH: "lad6" },
    "5 lygis": { support: "ladder", ladderH: "lad5" },
    // Legs on the ladder → a grip (and the ladder setup).
    hooked: { support: "ladder", ladderGrip: "hooked" },
    "l sit": { support: "ladder", ladderGrip: "lsit" },
    "l-sit": { support: "ladder", ladderGrip: "lsit" },
    lsit: { support: "ladder", ladderGrip: "lsit" },
  },
};

/** The bundled config (passed by default to the resolver; callers may pass their
 * own, e.g. a user-edited copy from storage, for the future token editor). */
export const DEFAULT_VARIATION_CONFIG: VariationConfig = { FAMILIES, TOKENS };

/** Bump on ANY edit to FAMILIES/TOKENS so caches keyed on (note, version) drop. */
export const CONFIG_VERSION = 21;

/**
 * Which family's model an exercise uses (decision: family = exercise). Many
 * spellings can share one family. Returns null when an exercise has no model yet,
 * in which case the caller falls back to the flat per-note scalar (×1 default).
 * The owner extends this map.
 */
export const EXERCISE_FAMILY: Record<string, string> = {
  "Handstand Push Ups": "HSPU",
  "Handstand Push Up": "HSPU",
  "Push Ups": "PUSHUP",
  "Push Up": "PUSHUP",
  // Smith-machine incline push-ups are the SAME push, just on the smith bar — people
  // log incline variations under either name — so they share the push-up model (and
  // its position/knees variation). Incline scaling already covers it by name pattern.
  "Smith Machine Incline Close Grip Push Up": "PUSHUP",
  "Pull Up": "PULLUP",
  "Pull Ups": "PULLUP",
  "Chin Up": "PULLUP",
  "Chin Ups": "PULLUP",
  "Roman Chair Side Bend": "RCSIDEBEND",
  "Knee Raise": "KNEERAISE",
  "Knee Raises": "KNEERAISE",
  "Hanging Knee Raise": "KNEERAISE",
  "Hanging Knee Raises": "KNEERAISE",
  "Cross-Legged Squats": "CROSSSQUAT",
  "Cross-Legged Squat": "CROSSSQUAT",
  "Cross-leg Squat": "CROSSSQUAT",
  "Cross-leg squat": "CROSSSQUAT",
  "Cross Legged Squat": "CROSSSQUAT",
  // Non-press handstand SKILL lifts → the shared HANDSTAND setup model (wall tap /
  // touch-shoulders, kicks, hold, walk, the bare "Handstand"). The pattern fallback
  // below catches every other handstand spelling/variant too; these explicit entries
  // document the common ones. (The PUSH-UP variants stay HSPU — matched first.)
  "Handstand wall touch": "HANDSTAND",
  "Handstand touch shoulders": "HANDSTAND",
  "Handstand touch shoulder": "HANDSTAND",
  "Handstand kicks": "HANDSTAND",
  "Handstand hold": "HANDSTAND",
  "Handstand walk": "HANDSTAND",
  Handstand: "HANDSTAND",
  // The four "Lever" wrist/forearm rotations (EXR-163) share ONE leverage model
  // — lever length (plate distance) × arm reach; see the LEVER family above.
  "Lever Pronation": "LEVER",
  "Lever Supination": "LEVER",
  "Lever Abduction": "LEVER",
  "Lever Adduction": "LEVER",
};

export function familyOf(
  exerciseName: string,
  map: Record<string, string> = EXERCISE_FAMILY,
): string | null {
  const exact = map[exerciseName];
  if (exact) return exact;
  // Pattern fallback so EVERY handstand push-up uses the HSPU model — however it's
  // spelled or wherever it came from (StrengthLevel CSV, created here, renamed) —
  // and so gets the full variation-multiplier math AND its "needs review" flags for
  // unknown notes. Matches "handstand push up(s)" in any spacing/hyphen/plural form,
  // and the "HSPU" code. (Holds / walks / kicks have no "pushup", so they're excluded.)
  const n = exerciseName.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Any handstand PUSH-UP (incl. a scapular / low-ROM / one-hand variant) uses the
  // HSPU model — "hspu" or "handstandpush" anywhere (holds / walks / kicks lack
  // "push", so they're still excluded).
  if (n.includes("hspu") || n.includes("handstandpush")) return "HSPU";
  // Any pull-up / chin-up uses the PULLUP model so band ("guma") assistance is read in
  // kg like HSPU — however it's spelled (assisted, wide/neutral grip, weighted…). Lat
  // PULLDOWNs contain "pull" but not "pullup", so they're correctly excluded.
  if (n.includes("pullup") || n.includes("chinup")) return "PULLUP";
  // A bare "Pull" / "Chin" is the owner's combined pull-up + chin-up lift — give it the
  // PULLUP model too (band "guma" picker + kg-assist), matched EXACTLY so "pulldown" /
  // "pullover" / "facepull" (which contain "pull" but aren't the bar movement) stay out.
  if (n === "pull" || n === "pulls" || n === "chin" || n === "chins") return "PULLUP";
  // Any OTHER handstand (wall tap / touch / kicks / hold / walk / steps / leg curls /
  // on head / dance…) uses the HANDSTAND setup model — "handstand" anywhere. The
  // push-up variants were already returned as HSPU above ("handstandpush" is caught
  // first), so this only catches the non-press handstand skill work.
  if (n.includes("handstand")) return "HANDSTAND";
  return null;
}

/** Centimetres encoded in a lean-level key (e.g. "15" → 15); 0 when unparseable. */
const leanCm = (key: string): number => { const n = parseInt(key, 10); return Number.isFinite(n) ? n : 0; };

/** Default lean table for a support. Back-to-wall gets a 15cm "grace": forward
 * lean does nothing for the first 15cm (you're against the wall), so the scale is
 * shifted DOWN 15cm — b2w factor(X) = base factor(X−15). Free / front-to-wall /
 * ladder use the base table (immediate, harder from the first cm). */
export function defaultLeanTable(family: string, support: string): Record<string, number> {
  const base = FAMILIES[family]?.dims.lean ?? {};
  if (support !== "back_to_wall") return base;
  const keys = Object.keys(base);
  const factorAtCm = (cm: number): number => {
    let bestKey = keys[0] ?? "";
    for (const k of keys) if (leanCm(k) <= cm && leanCm(k) >= leanCm(bestKey)) bestKey = k; // largest key ≤ cm
    return base[bestKey] ?? 1;
  };
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = factorAtCm(Math.max(0, leanCm(k) - 15));
  return out;
}
