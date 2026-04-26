import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/cn";

export function ConflictDialog() {
  const status = useEditorStore((s) => s.status);
  const flushSave = useEditorStore((s) => s.flushSave);
  const reloadFromDisk = useEditorStore((s) => s.reloadFromDisk);
  const currentPath = useEditorStore((s) => s.currentPath);
  const { t } = useTranslation(["editor"]);

  if (status.kind !== "conflict") return null;

  const handleOverwrite = async () => {
    if (!flushSave) return;
    await flushSave({ force: true });
  };

  const handleReload = async () => {
    await reloadFromDisk();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-title"
    >
      <div
        className={cn(
          "w-full max-w-md rounded-lg border p-6 shadow-xl",
          "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]",
        )}
      >
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-[var(--color-warning)]" />
          <h2 id="conflict-title" className="text-base font-semibold">
            {t("editor:conflict.title")}
          </h2>
        </div>
        <p className="mb-1 text-sm text-[var(--color-text-secondary)]">
          {t("editor:conflict.bodyBefore")}
          <code className="rounded bg-[var(--color-bg-tertiary)] px-1 py-0.5 text-xs">
            {currentPath}
          </code>
          {t("editor:conflict.bodyAfter")}
        </p>
        <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
          {t("editor:conflict.explainer")}
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleReload}
            className={cn(
              "inline-flex h-8 items-center rounded px-3 text-xs",
              "border border-[var(--color-border-primary)]",
              "hover:bg-[var(--color-bg-hover)]",
            )}
          >
            {t("editor:conflict.reload")}
          </button>
          <button
            type="button"
            onClick={handleOverwrite}
            className={cn(
              "inline-flex h-8 items-center rounded px-3 text-xs font-medium",
              "bg-[var(--color-warning-bg)] text-[var(--color-warning-contrast)]",
              "hover:opacity-90",
            )}
          >
            {t("editor:conflict.overwrite")}
          </button>
        </div>
      </div>
    </div>
  );
}
