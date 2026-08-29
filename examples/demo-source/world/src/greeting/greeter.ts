import type { GreetingOptions } from "./types.ts";
import { formatParts } from "./format/parts.ts";

/**
 * Builds a greeting string from config words.
 *
 * @param options - Greeting options
 */
export function buildGreeting(options: GreetingOptions): string {
  return formatParts(options.words, options.separator ?? " ");
}
