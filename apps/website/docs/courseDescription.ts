/** Course description from `course.jsonc`: one string, or a map of language tags. */
export type CourseDescription = string | Record<string, string>;

/**
 * Trims a course description and drops blank locale entries.
 *
 * A string stays a string. An object keeps only non-empty tags and text.
 * An empty string, an empty object, or a non-description value becomes `undefined`.
 *
 * @param value - Raw `description` from JSONC
 */
export function normalizeCourseDescription(value: unknown): CourseDescription | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const descriptions: Record<string, string> = {};
  for (const [key, text] of Object.entries(value)) {
    if (typeof text !== "string") {
      continue;
    }
    const tag = key.trim();
    const trimmed = text.trim();
    if (tag === "" || trimmed === "") {
      continue;
    }
    descriptions[tag] = trimmed;
  }
  return Object.keys(descriptions).length === 0 ? undefined : descriptions;
}

/**
 * Chooses one description string for `locale`.
 *
 * A language-neutral string is used for every locale. A map matches the full
 * tag, then its primary language, then `en`, then the first remaining text.
 *
 * @param description - Parsed course description
 * @param locale - Page language, such as `zh-CN`
 */
export function pickCourseDescription(
  description: CourseDescription | undefined,
  locale: string,
): string {
  if (description === undefined || description === "") {
    return "";
  }
  if (typeof description === "string") {
    return description;
  }
  const wanted = locale.trim();
  const exact = findDescriptionTag(description, wanted);
  if (exact !== undefined) {
    return exact;
  }
  const primary = wanted.split("-")[0] ?? "";
  if (primary !== "" && primary.toLowerCase() !== wanted.toLowerCase()) {
    const byLanguage = findDescriptionTag(description, primary);
    if (byLanguage !== undefined) {
      return byLanguage;
    }
    for (const [key, text] of Object.entries(description)) {
      if (key.split("-")[0]?.toLowerCase() === primary.toLowerCase()) {
        return text;
      }
    }
  }
  const english = findDescriptionTag(description, "en");
  if (english !== undefined) {
    return english;
  }
  const first = Object.values(description)[0];
  return first ?? "";
}

/**
 * Returns the text whose tag matches `wanted`, ignoring case.
 *
 * @param descriptions - Locale tag to text
 * @param wanted - Tag to find
 */
function findDescriptionTag(
  descriptions: Readonly<Record<string, string>>,
  wanted: string,
): string | undefined {
  const needle = wanted.toLowerCase();
  if (needle === "") {
    return undefined;
  }
  for (const [key, text] of Object.entries(descriptions)) {
    if (key.toLowerCase() === needle) {
      return text;
    }
  }
  return undefined;
}
