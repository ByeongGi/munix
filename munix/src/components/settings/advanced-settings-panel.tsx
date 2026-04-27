import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import { useSettingsStore } from "@/store/settings-store";
import { SettingsSection } from "./settings-controls";

export function AdvancedSettingsPanel() {
  const customCss = useSettingsStore((state) => state.customCss);
  const set = useSettingsStore((state) => state.set);
  const { t } = useTranslation(["settings", "common"]);

  return (
    <SettingsSection title={t("settings:section.advanced")}>
      <p className="text-[11px] text-[var(--color-text-tertiary)]">
        {t("settings:customCss.description")}
      </p>
      <textarea
        value={customCss}
        onChange={(event) => set({ customCss: event.target.value })}
        placeholder={t("settings:customCss.placeholder")}
        spellCheck={false}
        className={cn(
          "h-56 w-full resize-y rounded border p-3 font-mono text-xs",
          "border-[var(--color-border-secondary)] bg-[var(--color-bg-tertiary)]",
          "text-[var(--color-text-primary)]",
          "placeholder:text-[var(--color-text-tertiary)] outline-none",
          "focus:border-[var(--color-accent)]",
        )}
      />
    </SettingsSection>
  );
}
