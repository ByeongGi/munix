import type { PropertyType } from "@/types/frontmatter";

const DATE_KEY_RE =
  /^(date|created|updated|modified|published|publish|due|deadline|start|end)$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** explicit 타입이 있으면 그것을 그대로 반환. 없으면 키 이름과 값으로 휴리스틱 추론.
 *
 * 우선순위:
 * 1. 명시적 explicit (사용자가 우클릭으로 지정 — `.obsidian/types.json`)
 * 2. 키 이름 특수: tags/tag → tags, aliases/alias → aliases
 * 3. 값 typeof: boolean → checkbox, number → number, Array → multitext
 * 4. 키 이름 정규식 (date류): 값에 시각 'T' 포함 → datetime, 그 외 → date
 * 5. 값 모양: ISO datetime → datetime, ISO date → date
 * 6. fallback: text
 */
export function resolvePropertyType(
  field: string,
  value: unknown,
  explicit: PropertyType | undefined,
): PropertyType {
  if (explicit) return explicit;

  // 2. 키 이름 특수
  if (field === "tags" || field === "tag") return "tags";
  if (field === "aliases" || field === "alias") return "aliases";

  // 3. 값 typeof
  if (typeof value === "boolean") return "checkbox";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "multitext";

  // 4. 키 이름 정규식 (날짜류)
  if (DATE_KEY_RE.test(field)) {
    if (typeof value === "string" && ISO_DATETIME_RE.test(value)) {
      return "datetime";
    }
    return "date";
  }

  // 5. 값 모양 (ISO date / datetime)
  if (typeof value === "string") {
    if (ISO_DATETIME_RE.test(value)) return "datetime";
    if (ISO_DATE_RE.test(value)) return "date";
  }

  return "text";
}
