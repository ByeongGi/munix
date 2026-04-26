/** Frontmatter 속성 타입 (Obsidian `.obsidian/types.json` 호환).
 * 어휘는 Obsidian 과 정확히 일치 — ADR-028 참조. */
export type PropertyType =
  | "text"
  | "multitext"
  | "number"
  | "checkbox"
  | "date"
  | "datetime"
  | "tags"
  | "aliases";

export interface PropertyTypesFile {
  types: Record<string, PropertyType>;
}

export const KNOWN_PROPERTY_TYPES: readonly PropertyType[] = [
  "text",
  "multitext",
  "number",
  "checkbox",
  "date",
  "datetime",
  "tags",
  "aliases",
] as const;

export function isPropertyType(v: unknown): v is PropertyType {
  return (
    typeof v === "string" &&
    (KNOWN_PROPERTY_TYPES as readonly string[]).includes(v)
  );
}
