import { useTranslation } from "react-i18next";

import { SettingsSection } from "./settings-controls";

export function AboutSettingsPanel() {
  const { t } = useTranslation(["settings", "common"]);

  return (
    <SettingsSection title={t("settings:section.about")}>
      <p className="text-xs text-[var(--color-text-tertiary)]">
        {t("settings:about.tagline")}
      </p>
      <p className="text-xs text-[var(--color-text-tertiary)]">
        {t("settings:about.meta")}
      </p>
    </SettingsSection>
  );
}
