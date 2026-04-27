import { useTranslation } from "react-i18next";

export function FileTreeEmptyPlaceholder() {
  const { t } = useTranslation("tree");

  return (
    <div className="px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
      {t("empty")}
    </div>
  );
}
