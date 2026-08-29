/**
 * Shared greeting option types.
 */
export interface GreetingOptions {
  /** Base words to join into a greeting. */
  words: string[];
  /** Optional separator between words. */
  separator?: string;
  /** When true, appends an exclamation mark. */
  emphasize?: boolean;
}
