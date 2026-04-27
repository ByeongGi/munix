import type { PropertyType } from "@/types/frontmatter";

export function defaultValueForPropertyType(type: PropertyType): unknown {
  switch (type) {
    case "number":
      return null;
    case "checkbox":
      return false;
    case "multitext":
    case "tags":
    case "aliases":
      return [];
    case "date":
    case "datetime":
    case "text":
      return "";
  }
}
