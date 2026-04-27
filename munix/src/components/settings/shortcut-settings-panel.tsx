import { useTranslation } from "react-i18next";

import { KeymapSettings } from "@/components/keymap-settings";
import { SettingsSection } from "./settings-controls";

export function ShortcutSettingsPanel() {
  const { t } = useTranslation(["settings", "common"]);

  return (
    <SettingsSection title={t("settings:section.shortcuts")}>
      <KeymapSettings />
    </SettingsSection>
  );
}
