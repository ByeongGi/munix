import { describe, expect, it } from "vitest";
import type { Tab } from "./tab-slice";
import {
  closeTabInList,
  closeTabsAfterInList,
  closeUnpinnedTabsInList,
  promoteEmptyTab,
  removePathFromTabs,
  renamePathInTabs,
  reorderTabs,
} from "./tab-helpers";

function tab(id: string, path: string, pinned = false): Tab {
  return {
    id,
    path,
    title: path.replace(/\.md$/i, ""),
    pinned,
  };
}

describe("tab-helpers", () => {
  it("promotes the active empty tab", () => {
    const empty = tab("a", "");
    const result = promoteEmptyTab([empty], "a", "notes/today.md");

    expect(result?.tab.path).toBe("notes/today.md");
    expect(result?.tab.title).toBe("today");
    expect(result?.tabs[0]?.path).toBe("notes/today.md");
  });

  it("closes the active tab and selects the right neighbor first", () => {
    const result = closeTabInList(
      [tab("a", "a.md"), tab("b", "b.md"), tab("c", "c.md")],
      "b",
      "b",
    );

    expect(result?.tabs.map((item) => item.id)).toEqual(["a", "c"]);
    expect(result?.activeId).toBe("c");
    expect(result?.activeChanged).toBe(true);
  });

  it("keeps pinned tabs when closing tabs after a target", () => {
    const result = closeTabsAfterInList(
      [tab("a", "a.md"), tab("b", "b.md"), tab("c", "c.md", true)],
      "c",
      "a",
    );

    expect(result?.tabs.map((item) => item.id)).toEqual(["a", "c"]);
    expect(result?.activeId).toBe("c");
    expect(result?.activeChanged).toBe(false);
  });

  it("closes all unpinned tabs and activates the first pinned tab", () => {
    const result = closeUnpinnedTabsInList(
      [tab("a", "a.md"), tab("b", "b.md", true), tab("c", "c.md", true)],
      "a",
    );

    expect(result.tabs.map((item) => item.id)).toEqual(["b", "c"]);
    expect(result.activeId).toBe("b");
  });

  it("renames matching paths and descendants", () => {
    const result = renamePathInTabs(
      [tab("a", "old.md"), tab("b", "folder/a.md"), tab("c", "folder/sub.md")],
      "folder",
      "renamed",
    );

    expect(result.map((item) => item.path)).toEqual([
      "old.md",
      "renamed/a.md",
      "renamed/sub.md",
    ]);
    expect(result[1]?.title).toBe("a");
  });

  it("removes matching paths and descendants while selecting a neighbor", () => {
    const result = removePathFromTabs(
      [tab("a", "keep.md"), tab("b", "folder/a.md"), tab("c", "next.md")],
      "b",
      "folder",
    );

    expect(result?.tabs.map((item) => item.id)).toEqual(["a", "c"]);
    expect(result?.activeId).toBe("c");
  });

  it("reorders tabs with a clamped destination index", () => {
    const result = reorderTabs(
      [tab("a", "a.md"), tab("b", "b.md"), tab("c", "c.md")],
      0,
      99,
    );

    expect(result?.map((item) => item.id)).toEqual(["b", "c", "a"]);
  });
});
