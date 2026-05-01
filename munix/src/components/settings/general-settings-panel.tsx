import { useTranslation } from "react-i18next";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { useSettingsStore } from "@/store/settings-store";
import { useThemeStore, type ThemeMode } from "@/store/theme-store";
import {
  LanguageSelector,
  RangeControl,
  SettingsSection,
} from "./settings-controls";

export function GeneralSettingsPanel() {
  const language = useSettingsStore((state) => state.language);
  const backgroundOpacity = useSettingsStore(
    (state) => state.backgroundOpacity,
  );
  const editorBackgroundOpacity = useSettingsStore(
    (state) => state.editorBackgroundOpacity,
  );
  const set = useSettingsStore((state) => state.set);
  const theme = useThemeStore((state) => state.mode);
  const setTheme = useThemeStore((state) => state.set);
  const { t } = useTranslation(["settings", "common"]);

  return (
    <SettingsSection title={t("settings:section.appearance")}>
      <SegmentedControl<ThemeMode>
        label={t("settings:theme.label")}
        value={theme}
        options={[
          { value: "system", label: t("settings:theme.system") },
          { value: "light", label: t("settings:theme.light") },
          { value: "dark", label: t("settings:theme.dark") },
        ]}
        onChange={setTheme}
      />
      <LanguageSelector
        value={language}
        onChange={(value) => set({ language: value })}
        label={t("settings:language.label")}
        description={t("settings:language.description")}
        options={[
          { value: "auto", label: t("settings:language.auto") },
          { value: "ko", label: t("settings:language.ko") },
          { value: "en", label: t("settings:language.en") },
        ]}
      />
      <RangeControl
        label={t("settings:backgroundOpacity.label")}
        description={t("settings:backgroundOpacity.description")}
        value={backgroundOpacity}
        min={20}
        max={100}
        valueLabel={t("settings:backgroundOpacity.value", {
          value: backgroundOpacity,
        })}
        onChange={(value) => set({ backgroundOpacity: value })}
      />
      <RangeControl
        label={t("settings:editorBackgroundOpacity.label")}
        description={t("settings:editorBackgroundOpacity.description")}
        value={editorBackgroundOpacity}
        min={20}
        max={100}
        valueLabel={t("settings:editorBackgroundOpacity.value", {
          value: editorBackgroundOpacity,
        })}
        onChange={(value) => set({ editorBackgroundOpacity: value })}
      />
    </SettingsSection>
  );
}
