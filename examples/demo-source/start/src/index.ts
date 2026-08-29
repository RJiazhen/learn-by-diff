import { greetingConfig } from "./greeting/config.ts";

/**
 * Returns an empty greeting. Implement chapter "hello".
 */
export function greet(): string {
  return greetingConfig.words.join(" ");
}
