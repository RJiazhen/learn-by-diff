/**
 * Joins greeting parts with a separator and optional emphasis.
 *
 * @param parts - Words to join
 * @param separator - Separator string
 * @param emphasize - Whether to append `!`
 */
export function formatParts(parts: string[], separator: string, emphasize = false): string {
  const body = parts.join(separator);
  return emphasize ? `${body}!` : body;
}
