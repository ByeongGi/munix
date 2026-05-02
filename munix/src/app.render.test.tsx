import { act } from "react";
import type { ComponentType, ForwardedRef, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/app";
import { resetIpcClient, setIpcClient } from "@/lib/ipc";
import { setupI18n } from "@/lib/i18n";
import { useVaultDockStore } from "@/store/vault-dock-store";
import { useVaultStore } from "@/store/vault-store";
import {
  disposeWorkspaceStore,
  listWorkspaceVaultIds,
} from "@/store/workspace-registry";
import { createMockIpcClient } from "@/testing/mock-ipc";

const MOCK_ROOT = "/tmp/munix-render-vault";

vi.mock("react-virtuoso", async () => {
  const React = await import("react");
  return {
    Virtuoso: React.forwardRef(
      (
        {
          totalCount,
          itemContent,
          components,
        }: {
          totalCount: number;
          itemContent: (index: number) => ReactNode;
          components?: {
            EmptyPlaceholder?: ComponentType;
          };
        },
        ref: ForwardedRef<HTMLDivElement>,
      ) => {
        if (totalCount === 0 && components?.EmptyPlaceholder) {
          return React.createElement(components.EmptyPlaceholder);
        }
        return React.createElement(
          "div",
          { ref },
          Array.from({ length: totalCount }, (_, index) =>
            React.createElement(
              "div",
              { key: index, "data-testid": "mock-virtuoso-row" },
              itemContent(index),
            ),
          ),
        );
      },
    ),
  };
});

function resetStores() {
  for (const vaultId of listWorkspaceVaultIds()) {
    disposeWorkspaceStore(vaultId);
  }
  useVaultStore.setState({
    info: null,
    files: [],
    loading: false,
    error: null,
  });
  useVaultDockStore.setState({
    vaults: [],
    activeVaultId: null,
    loading: false,
    visible: true,
  });
}

describe("App render harness", () => {
  let restoreIpc: (() => void) | null = null;

  beforeEach(() => {
    setupI18n();
    restoreIpc = setIpcClient(createMockIpcClient({ root: MOCK_ROOT }));
    resetStores();
  });

  afterEach(() => {
    cleanup();
    restoreIpc?.();
    restoreIpc = null;
    resetIpcClient();
    resetStores();
    localStorage.clear();
  });

  it("renders the vault picker without a Tauri runtime", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /Munix/ })).toBeVisible();
    expect(
      await screen.findByText("description.choosePrompt"),
    ).toBeInTheDocument();
  });

  it("renders a mocked vault workspace and file tree", async () => {
    await act(async () => {
      await useVaultStore.getState().open(MOCK_ROOT);
    });

    render(<App />);

    expect(await screen.findByText("Welcome.md")).toBeVisible();
    expect(screen.getByTitle(MOCK_ROOT)).toBeVisible();
  });
});
