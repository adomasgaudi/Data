import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn's `cn` — merge conditional classes and de-dupe conflicting Tailwind ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
