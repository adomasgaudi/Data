/**
 * Per-exercise graph config for the exercise-info Curve tab — same bubble model as the
 * main analysis dashboard, persisted separately so each lift remembers its own graph
 * type / metrics / ×BW / pan-zoom without touching the global dashboard.
 */
import { z } from "zod";
import { loadJsonObject, saveJson } from "./storage";
import { makeBubble, type GraphBubble } from "./graphDash";

export const EX_INFO_GRAPH_KEY = "colosseum.exInfoGraph.v1";

const DB = makeBubble();
const BubbleSchema = z.object({
  id: z.string(),
  type: z.enum(["time", "rvw"]).catch(DB.type),
  view: z.enum(["single", "multi"]).catch(DB.view),
  exercises: z.array(z.string()).catch([]),
  athletes: z.array(z.string()).catch([]),
  perBodyweight: z.boolean().catch(DB.perBodyweight),
  metrics: z.array(z.string()).catch(DB.metrics),
  savedView: z
    .object({
      sig: z.string(),
      box: z.object({ xMin: z.number(), xMax: z.number(), yMin: z.number(), yMax: z.number() }),
    })
    .nullish()
    .catch(null),
});

const StoreSchema = z.record(z.string(), BubbleSchema);

function loadAll(): Record<string, GraphBubble> {
  const parsed = StoreSchema.safeParse(loadJsonObject(EX_INFO_GRAPH_KEY));
  if (!parsed.success) return {};
  const out: Record<string, GraphBubble> = {};
  for (const [ex, b] of Object.entries(parsed.data)) out[ex] = { ...makeBubble(), ...b };
  return out;
}

/** Default: reps×kg scatter (matches the old Curve tab) with 1RM metric ready for time view. */
export function defaultExInfoBubble(exercise: string): GraphBubble {
  return makeBubble({ type: "rvw", view: "single", exercises: [exercise], metrics: ["e1rm"] });
}

export function loadExInfoBubble(exercise: string): GraphBubble {
  const stored = loadAll()[exercise];
  if (stored) return { ...stored, exercises: [exercise], view: "single" };
  return defaultExInfoBubble(exercise);
}

export function saveExInfoBubble(exercise: string, bubble: GraphBubble): void {
  const all = loadAll();
  all[exercise] = { ...bubble, exercises: [exercise], view: "single" };
  saveJson(EX_INFO_GRAPH_KEY, all);
}

export function patchExInfoBubble(exercise: string, patch: Partial<GraphBubble>): GraphBubble {
  const next = { ...loadExInfoBubble(exercise), ...patch, exercises: [exercise], view: "single" as const };
  saveExInfoBubble(exercise, next);
  return next;
}

export function cycleExInfoBubbleType(exercise: string): GraphBubble {
  const b = loadExInfoBubble(exercise);
  return patchExInfoBubble(exercise, { type: b.type === "rvw" ? "time" : "rvw" });
}
