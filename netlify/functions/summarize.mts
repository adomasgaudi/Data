/**
 * Netlify Function — POST /api/summarize
 *
 * Turns a compact block of an athlete's computed stats into a short, plain
 * summary using Google Gemini (free tier). The API key lives only here, in the
 * GEMINI_API_KEY environment variable — never in the shipped page.
 *
 * The browser sends already-computed numbers (not the raw set log), so this
 * stays cheap and fast. The summary is generated live, so it always reflects
 * the latest data.
 */

// Netlify's runtime provides process.env; declare it locally to avoid pulling in @types/node.
declare const process: { env: Record<string, string | undefined> };

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

const SYSTEM = [
  "You are a concise strength coach.",
  "Given an athlete's training stats, write 2–4 short sentences summarising them:",
  "current focus, standout lifts, and one thing to note (e.g. a neglected area or a strong ratio).",
  "Use the actual numbers. Be specific and plain. No markdown, no headings, no bullet points, no preamble.",
].join(" ");

export default async (req: Request): Promise<Response> => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });

  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: "AI is not configured (missing GEMINI_API_KEY)." }, 500);

  let context = "";
  try {
    const body = (await req.json()) as { context?: unknown };
    context = typeof body.context === "string" ? body.context : "";
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (!context.trim()) return json({ error: "No stats to summarise." }, 400);

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=` +
      encodeURIComponent(key);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: context }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 220 },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: `AI request failed (${res.status}).`, detail }, 502);
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const summary = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (!summary) return json({ error: "AI returned no text." }, 502);
    return json({ summary });
  } catch (err) {
    return json({ error: String(err) }, 502);
  }
};

export const config = { path: "/api/summarize" };
