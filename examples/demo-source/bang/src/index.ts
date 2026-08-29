import { greetingConfig } from "./greeting/config.ts";
import { buildGreeting } from "./greeting/greeter.ts";

/**
 * Returns a greeting with emphasis.
 */
export function greet(): string {
  return buildGreeting(greetingConfig);
}
