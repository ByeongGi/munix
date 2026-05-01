import { afterEach, describe, expect, it } from "vitest";

import {
  disposeWorkspaceStore,
  getWorkspaceStore,
  hydrateWorkspaceStore,
} from "./workspace-registry";
import type { WorkspaceNode } from "./workspace-types";
import type { Tab } from "./slices/tab-slice";

function documentTab(id: string, path: string): Tab {
  return { id, kind: "document", path, title: path.replace(/\.md$/, "") };
}

function terminalTab(id: string): Tab {
  return { id, kind: "terminal", path: "", title: "Terminal" };
}

describe("workspace-registry persistence", () => {
  const vaultIds: string[] = [];

  afterEach(() => {
    for (const vaultId of vaultIds.splice(0)) {
      disposeWorkspaceStore(vaultId);
    }
  });

  function makeStore() {
    const vaultId = `test-vault-${crypto.randomUUID()}`;
    vaultIds.push(vaultId);
    return getWorkspaceStore(vaultId);
  }

  it("drops terminal tabs when hydrating a legacy single-pane workspace", () => {
    const store = makeStore();

    hydrateWorkspaceStore(
      store,
      JSON.stringify({
        version: 1,
        tabs: [terminalTab("term-1"), documentTab("doc-1", "notes/a.md")],
        activeId: "term-1",
        fileTreeExpanded: [],
      }),
    );

    const state = store.getState();
    expect(state.tabs.map((tab) => tab.id)).toEqual(["doc-1"]);
    expect(state.activeId).toBe("doc-1");
  });

  it("collapses terminal-only panes without losing the remaining document pane", () => {
    const store = makeStore();
    const tree: WorkspaceNode = {
      type: "split",
      id: "split-1",
      direction: "row",
      ratio: 0.5,
      first: {
        type: "pane",
        id: "pane-term",
        tabs: [terminalTab("term-1")],
        activeTabId: "term-1",
      },
      second: {
        type: "pane",
        id: "pane-doc",
        tabs: [documentTab("doc-1", "notes/a.md")],
        activeTabId: "doc-1",
      },
    };

    hydrateWorkspaceStore(
      store,
      JSON.stringify({
        version: 2,
        workspaceTree: tree,
        activePaneId: "pane-term",
        tabs: [terminalTab("term-1")],
        activeId: "term-1",
        fileTreeExpanded: [],
      }),
    );

    const state = store.getState();
    expect(state.workspaceTree).toBeNull();
    expect(state.activePaneId).toBeNull();
    expect(state.tabs.map((tab) => tab.id)).toEqual(["doc-1"]);
    expect(state.activeId).toBe("doc-1");
  });
});
