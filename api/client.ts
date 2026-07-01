import { initClient } from "@ts-rest/core";
import { contract } from "./contract";

/**
 * Fully-typed client for the contract above. Paths are absolute (`/api/*`), so
 * baseUrl is the same origin ("") in the browser. Every call and its response
 * are checked against the zod schemas at compile time.
 */
export const apiClient = initClient(contract, {
  baseUrl: "",
  baseHeaders: {},
});
