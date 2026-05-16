import { describe, expect, it } from "vitest";

import {
  appendContent,
  prependContent,
  resolveCreatePathFromNodes,
  resolveFileTargetPathFromNodes,
} from "./cli-target-utils";
import type { FileNode } from "@/types/ipc";

function file(path: string): FileNode {
  return {
    path,
    name: path.split("/").at(-1) ?? path,
    kind: "file",
    size: 0,
    modified: 0,
    children: null,
  };
}

describe("cli-target-utils", () => {
  it("resolves file= by basename without markdown extension", () => {
    expect(
      resolveFileTargetPathFromNodes({ file: "Recipe" }, [
        file("Notes/Recipe.md"),
      ]),
    ).toBe("Notes/Recipe.md");
  });

  it("resolves file= path targets with optional markdown extension", () => {
    const files = [file("Templates/Recipe.md"), file("Notes/Recipe.md")];

    expect(
      resolveFileTargetPathFromNodes({ file: "Templates/Recipe" }, files),
    ).toBe("Templates/Recipe.md");
  });

  it("rejects ambiguous basename file targets", () => {
    expect(() =>
      resolveFileTargetPathFromNodes({ file: "Recipe" }, [
        file("Templates/Recipe.md"),
        file("Notes/Recipe.md"),
      ]),
    ).toThrow("Ambiguous file target");
  });

  it("normalizes create name and default untitled paths", () => {
    expect(resolveCreatePathFromNodes({ name: "Trip" }, [])).toBe("Trip.md");
    expect(resolveCreatePathFromNodes({ path: "Inbox/Trip" }, [])).toBe(
      "Inbox/Trip.md",
    );
    expect(
      resolveCreatePathFromNodes({}, [
        file("Untitled.md"),
        file("Untitled 1.md"),
      ]),
    ).toBe("Untitled 2.md");
  });

  it("appends and prepends blocks with inline support", () => {
    expect(appendContent("a", "b", false)).toBe("a\nb");
    expect(appendContent("a", "b", true)).toBe("ab");
    expect(prependContent("a", "b", false)).toBe("b\na");
    expect(prependContent("a", "b", true)).toBe("ba");
  });

  it("prepends after frontmatter", () => {
    expect(prependContent("---\ntitle: A\n---\nBody", "Intro", false)).toBe(
      "---\ntitle: A\n---\nIntro\nBody",
    );
    expect(prependContent("---\ntitle: A\n---", "Intro", false)).toBe(
      "---\ntitle: A\n---\nIntro",
    );
  });
});
