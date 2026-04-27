import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { ipc } from "@/lib/ipc";
import type { FileNode } from "@/types/ipc";

export function useFileSystemActions() {
  const { t } = useTranslation("app");

  const copyPath = useCallback(
    (node: FileNode) => {
      void (async () => {
        try {
          const abs = await ipc.absPath(node.path);
          await ipc.copyText(abs);
        } catch (error) {
          console.error("copy-path failed", error);
          window.alert(
            t("copyPath.errorAlert", {
              reason:
                error instanceof Error ? error.message : JSON.stringify(error),
            }),
          );
        }
      })();
    },
    [t],
  );

  const reveal = useCallback(
    (node: FileNode) => {
      void (async () => {
        try {
          await ipc.revealInSystem(node.path);
        } catch (error) {
          if (isVaultErrorType(error, "PermissionRequired")) {
            const ok = window.confirm(t("trust.revealPrompt"));
            if (!ok) return;
            try {
              await ipc.trustCurrentVault();
              await ipc.revealInSystem(node.path);
              return;
            } catch (retryError) {
              console.error("reveal after trust failed", retryError);
              window.alert(
                t("reveal.errorAlert", {
                  reason:
                    retryError instanceof Error
                      ? retryError.message
                      : JSON.stringify(retryError),
                }),
              );
              return;
            }
          }

          console.error("reveal failed", error);
          window.alert(
            t("reveal.errorAlert", {
              reason:
                error instanceof Error ? error.message : JSON.stringify(error),
            }),
          );
        }
      })();
    },
    [t],
  );

  return {
    copyPath,
    reveal,
  };
}

function isVaultErrorType(error: unknown, type: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: unknown }).type === type
  );
}
