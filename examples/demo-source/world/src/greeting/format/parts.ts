/**
 * Joins greeting parts with a separator.
 *
 * @param parts - Words to join
 * @param separator - Separator string
 */
export function formatParts(parts: string[], separator: string): string {
  return parts.join(separator);
}
