import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetIpcClient, setIpcClient } from "@/lib/ipc";
import { VaultSearchIndex } from "@/lib/search-index";
import { createMockIpcClient } from "@/testing/mock-ipc";
import type { FileNode } from "@/types/ipc";

const docs = {
  "Welcome.md": "# Welcome\n\nThis page mentions Munix and search.",
  "Projects/Roadmap.md":
    "# Roadmap\n\nMunix search roadmap\nMunix search again",
  "Archive/Plain.md": "# Plain\n\nNo target phrase here.",
};

function file(path: string): FileNode {
  return {
    path,
    name: path.split("/").pop() ?? path,
    kind: "file",
    size: 0,
    modified: 0,
    children: null,
  };
}

describe("VaultSearchIndex", () => {
  let restoreIpc: (() => void) | null = null;

  beforeEach(() => {
    restoreIpc = setIpcClient(createMockIpcClient({ docs }));
  });

  afterEach(() => {
    restoreIpc?.();
    restoreIpc = null;
    resetIpcClient();
  });

  async function buildIndex() {
    const index = new VaultSearchIndex();
    await index.build([
      file("Welcome.md"),
      {
        path: "Projects",
        name: "Projects",
        kind: "directory",
        size: null,
        modified: null,
        children: [file("Projects/Roadmap.md")],
      },
      {
        path: "Archive",
        name: "Archive",
        kind: "directory",
        size: null,
        modified: null,
        children: [file("Archive/Plain.md")],
      },
    ]);
    return index;
  }

  it("builds from markdown files and searches by body", async () => {
    const index = await buildIndex();

    const hits = index.search("roadmap");

    expect(hits[0]?.path).toBe("Projects/Roadmap.md");
    expect(hits[0]?.matchedLine).toBe(1);
  });

  it("searches with regex and ranks by match count", async () => {
    const index = await buildIndex();

    const hits = index.searchRegex("Munix search");

    expect(hits[0]).toMatchObject({
      path: "Projects/Roadmap.md",
      score: 2,
      matchedLine: 3,
    });
  });

  it("throws on invalid regex patterns", async () => {
    const index = await buildIndex();

    expect(() => index.searchRegex("(")).toThrow();
  });

  it("updates, renames, and removes indexed documents", async () => {
    const index = await buildIndex();

    index.updateDoc("Welcome.md", "unique phrase");
    expect(index.search("unique")[0]?.path).toBe("Welcome.md");

    index.renameDoc("Welcome.md", "Renamed.md");
    expect(index.search("unique")[0]?.path).toBe("Renamed.md");

    index.removeDoc("Renamed.md");
    expect(index.search("unique")).toEqual([]);
  });
});
