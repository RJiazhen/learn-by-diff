import type { GreetingOptions } from "./types.ts";

/**
 * Builds a greeting string from config words.
 *
 * @param options - Greeting options
 */
export function buildGreeting(options: GreetingOptions): string {
  return options.words.join(" ");
}
