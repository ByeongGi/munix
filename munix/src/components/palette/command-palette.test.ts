import { describe, expect, it } from "vitest";

import { extractHeadings, parseMode } from "./command-palette-utils";

describe("parseMode", () => {
  it("uses file search when no prefix is present", () => {
    expect(parseMode("daily")).toEqual({ mode: "file", text: "daily" });
  });

  it("parses command prefix", () => {
    expect(parseMode("> theme")).toEqual({
      mode: "command",
      text: "theme",
    });
  });

  it("parses tag, heading, and line prefixes", () => {
    expect(parseMode("#project")).toEqual({ mode: "tag", text: "project" });
    expect(parseMode("@intro")).toEqual({ mode: "heading", text: "intro" });
    expect(parseMode(":42")).toEqual({ mode: "line", text: "42" });
  });
});

describe("extractHeadings", () => {
  it("returns markdown headings with levels", () => {
    expect(
      extractHeadings(
        ["# Title", "body", "### Detail", "#### Deep"].join("\n"),
      ),
    ).toEqual([
      { level: 1, text: "Title" },
      { level: 3, text: "Detail" },
      { level: 4, text: "Deep" },
    ]);
  });
});
