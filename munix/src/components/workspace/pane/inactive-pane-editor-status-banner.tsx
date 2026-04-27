import { useTranslation } from "react-i18next";

import type { InactiveEditorStatus } from "./inactive-pane-editor-types";

export function InactivePaneEditorStatusBanner({
  status,
}: {
  status: InactiveEditorStatus;
}) {
  const { t } = useTranslation(["app"]);
  if (status !== "conflict" && status !== "saveError") return null;

  return (
    <div className="sticky top-0 z-10 border-b border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-3 py-2 text-xs text-[var(--color-danger)]">
      {status === "conflict"
        ? t("app:pane.editorConflict")
        : t("app:pane.editorSaveError")}
    </div>
  );
}
