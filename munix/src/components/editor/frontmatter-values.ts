export type FrontmatterFieldKind = "date" | "number" | "boolean" | "text";

const arrayKeys = new Set(["tags", "aliases", "keywords"]);

const DATE_KEY_RE =
  /^(date|created|updated|modified|published|publish|due|deadline|start|end)$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toFrontmatterDisplayValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function isEditableFrontmatterValue(value: unknown): boolean {
  return (
    value == null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    isStringArray(value)
  );
}

export function parseFrontmatterValue(
  key: string,
  raw: string,
  previous: unknown,
): unknown {
  const trimmed = raw.trim();
  if (arrayKeys.has(key) || Array.isArray(previous)) {
    if (!trimmed) return [];
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof previous === "boolean") return trimmed === "true";
  if (typeof previous === "number") {
    const next = Number(trimmed);
    return Number.isNaN(next) ? previous : next;
  }
  return trimmed;
}

export function frontmatterFieldKind(
  key: string,
  value: unknown,
): FrontmatterFieldKind {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "text";
  if (typeof value === "string") {
    if (DATE_KEY_RE.test(key)) return "date";
    if (ISO_DATE_RE.test(value)) return "date";
  }
  return "text";
}
