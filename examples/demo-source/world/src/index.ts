import { greetingConfig } from "./greeting/config.ts";
import { buildGreeting } from "./greeting/greeter.ts";

/**
 * Returns a fuller greeting. Next: chapter "bang".
 */
export function greet(): string {
  return buildGreeting(greetingConfig);
}
