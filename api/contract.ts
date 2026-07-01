import { initContract } from "@ts-rest/core";
import { z } from "zod";

/**
 * Typed API contract (ts-rest) for the Netlify functions the browser calls.
 * One zod-validated source of truth shared by client and (future) server, so a
 * response-shape drift is a compile error, not a runtime surprise.
 */
const c = initContract();

export const SetRowSchema = z.object({
  username: z.string(),
  date: z.string(),
  exercise_name: z.string(),
  weight: z.number().nullable(),
  reps: z.number().nullable(),
});
export type SetRow = z.infer<typeof SetRowSchema>;

export const contract = c.router({
  getData: {
    method: "GET",
    path: "/api/data",
    responses: {
      200: z.object({
        rows: z.array(SetRowSchema),
        errors: z.array(z.string()).optional(),
      }),
    },
    summary: "Fetch the flattened StrengthLevel set log",
  },
  summarize: {
    method: "POST",
    path: "/api/summarize",
    body: z.object({ stats: z.string() }),
    responses: { 200: z.object({ summary: z.string() }) },
    summary: "LLM summary of an athlete's computed stats",
  },
});
