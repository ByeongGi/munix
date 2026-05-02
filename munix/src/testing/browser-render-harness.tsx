import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import "katex/dist/katex.min.css";

import { Root } from "@/root";
import { setIpcClient } from "@/lib/ipc";
import { setupI18n } from "@/lib/i18n";
import { useVaultStore } from "@/store/vault-store";
import {
  createMockIpcClient,
  createMockRegistryWithClosedVault,
} from "@/testing/mock-ipc";

const MOCK_ROOT = "/tmp/munix-render-vault";
const MISSING_ROOT = "/tmp/missing-munix-vault";

async function boot() {
  const scenario = new URLSearchParams(window.location.search).get("scenario");
  setIpcClient(
    createMockIpcClient({
      root: MOCK_ROOT,
      registry:
        scenario === "closed-vault"
          ? createMockRegistryWithClosedVault(MISSING_ROOT)
          : scenario === "recent-vault"
            ? createMockRegistryWithClosedVault(MOCK_ROOT)
            : undefined,
    }),
  );

  const i18n = setupI18n();
  await i18n.changeLanguage("en");

  if (scenario === "vault") {
    await useVaultStore.getState().open(MOCK_ROOT);
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  );
}

void boot();
