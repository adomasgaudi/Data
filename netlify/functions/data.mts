/**
 * Netlify Function — GET /api/data
 *
 * Fetches StrengthLevel directly, server-side (Netlify's servers have open
 * outbound network, so no CORS and no allowlist limits), the SAME way the Apps
 * Script does. Returns the flattened set log as JSON for the browser.
 *
 * The response is cached on Netlify's edge (durable, 6h) so the heavy scrape
 * runs at most about once every few hours, not on every visitor.
 */
import { fetchAllRows } from "../../src/strengthlevel";

export default async (_req: Request): Promise<Response> => {
  try {
    const result = await fetchAllRows();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // Edge cache so most visitors get an instant cached copy.
        "Netlify-CDN-Cache-Control": "public, durable, s-maxage=21600, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err), rows: [] }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
};

// Maps this function to the /api/data URL the frontend calls.
export const config = { path: "/api/data" };
