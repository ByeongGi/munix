import {
  Check,
  Circle,
  Loader2,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEditorStore } from "@/store/editor-store";

export function SaveIndicator() {
  const status = useEditorStore((s) => s.status);
  const { t } = useTranslation(["editor"]);

  switch (status.kind) {
    case "idle":
      return null;
    case "dirty":
      return (
        <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
          <Circle className="h-3 w-3" /> {t("editor:saveStatus.dirty")}
        </span>
      );
    case "saving":
      return (
        <span className="flex items-center gap-1.5 text-xs text-[var(--color-info)]">
          <Loader2 className="h-3 w-3 animate-spin" />{" "}
          {t("editor:saveStatus.saving")}
        </span>
      );
    case "saved":
      return (
        <span className="flex items-center gap-1.5 text-xs text-[var(--color-success)]">
          <Check className="h-3 w-3" /> {t("editor:saveStatus.saved")}
        </span>
      );
    case "conflict":
      return (
        <span className="flex items-center gap-1.5 text-xs text-[var(--color-warning)]">
          <AlertTriangle className="h-3 w-3" />{" "}
          {t("editor:saveStatus.conflict")}
        </span>
      );
    case "error":
      return (
        <span
          className="flex items-center gap-1.5 text-xs text-[var(--color-danger)]"
          title={status.error}
        >
          <AlertCircle className="h-3 w-3" /> {t("editor:saveStatus.error")}
        </span>
      );
  }
}
