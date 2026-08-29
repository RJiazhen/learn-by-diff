import { greetingConfig } from "./greeting/config.ts";
import { buildGreeting } from "./greeting/greeter.ts";

/**
 * Returns a greeting. Next: chapter "world".
 */
export function greet(): string {
  return buildGreeting(greetingConfig);
}
