import { describe, expect, it } from "vitest";

import {
  frontmatterFieldKind,
  isEditableFrontmatterValue,
  parseFrontmatterValue,
  toFrontmatterDisplayValue,
} from "@/components/editor/frontmatter-values";

describe("frontmatter value helpers", () => {
  it("formats primitive and array values for display", () => {
    expect(toFrontmatterDisplayValue(["alpha", "beta"])).toBe("alpha, beta");
    expect(toFrontmatterDisplayValue(true)).toBe("true");
    expect(toFrontmatterDisplayValue(3)).toBe("3");
    expect(toFrontmatterDisplayValue(null)).toBe("");
  });

  it("parses tags, aliases, and keywords as comma-separated arrays", () => {
    expect(parseFrontmatterValue("tags", "alpha, beta,,", null)).toEqual([
      "alpha",
      "beta",
    ]);
    expect(parseFrontmatterValue("aliases", "one, two", null)).toEqual([
      "one",
      "two",
    ]);
    expect(parseFrontmatterValue("keywords", "", null)).toEqual([]);
  });

  it("preserves previous scalar types when parsing edits", () => {
    expect(parseFrontmatterValue("draft", "false", true)).toBe(false);
    expect(parseFrontmatterValue("count", "42", 1)).toBe(42);
    expect(parseFrontmatterValue("count", "not-a-number", 1)).toBe(1);
    expect(parseFrontmatterValue("title", " Note ", "old")).toBe("Note");
  });

  it("classifies field kinds for editor widgets", () => {
    expect(frontmatterFieldKind("draft", false)).toBe("boolean");
    expect(frontmatterFieldKind("count", 1)).toBe("number");
    expect(frontmatterFieldKind("created", "")).toBe("date");
    expect(frontmatterFieldKind("custom", "2026-05-02")).toBe("date");
    expect(frontmatterFieldKind("tags", ["a"])).toBe("text");
  });

  it("allows only simple editable frontmatter values", () => {
    expect(isEditableFrontmatterValue(["a", "b"])).toBe(true);
    expect(isEditableFrontmatterValue(["a", 1])).toBe(false);
    expect(isEditableFrontmatterValue({ nested: true })).toBe(false);
  });
});
