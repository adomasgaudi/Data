/**
 * Cloudflare Pages Function — optional same-origin proxy for the data endpoint.
 *
 * The browser calls /api/data (same origin → zero CORS concerns). This function
 * fetches the upstream Apps Script JSON server-side and returns it, adding a
 * short edge cache so 20 users hitting the dashboard don't each re-trigger the
 * upstream. Set UPSTREAM_DATA_URL in the Pages project env to your deployed
 * Apps Script web-app URL.
 *
 * Deploy target: Cloudflare Pages (functions/ directory is auto-detected).
 * If you instead point VITE_DATA_URL straight at the Apps Script URL and CORS
 * works, you don't need this file at all.
 */
interface Env {
  UPSTREAM_DATA_URL?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const upstream = context.env.UPSTREAM_DATA_URL;
  if (!upstream) {
    return json({ error: "UPSTREAM_DATA_URL not configured" }, 500);
  }

  const res = await fetch(upstream, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    return json({ error: `Upstream HTTP ${res.status}` }, 502);
  }

  const body = await res.text();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Cache at the edge for 5 min; serve stale for an hour while revalidating.
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
