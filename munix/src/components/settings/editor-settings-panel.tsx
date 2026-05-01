import { useTranslation } from "react-i18next";

import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  useSettingsStore,
  type AutoSaveDebounceMs,
  type EditorWidth,
  type FontSize,
} from "@/store/settings-store";
import { SettingsSection } from "./settings-controls";

export function EditorSettingsPanel() {
  const fontSize = useSettingsStore((state) => state.fontSize);
  const editorWidth = useSettingsStore((state) => state.editorWidth);
  const autoSaveDebounceMs = useSettingsStore(
    (state) => state.autoSaveDebounceMs,
  );
  const set = useSettingsStore((state) => state.set);
  const { t } = useTranslation(["settings", "common"]);

  return (
    <SettingsSection title={t("settings:section.editor")}>
      <SegmentedControl<FontSize>
        label={t("settings:fontSize.label")}
        value={fontSize}
        options={[
          { value: "sm", label: t("settings:fontSize.sm") },
          { value: "base", label: t("settings:fontSize.base") },
          { value: "lg", label: t("settings:fontSize.lg") },
          { value: "xl", label: t("settings:fontSize.xl") },
          { value: "xxl", label: t("settings:fontSize.xxl") },
          { value: "xxxl", label: t("settings:fontSize.xxxl") },
        ]}
        onChange={(value) => set({ fontSize: value })}
      />
      <SegmentedControl<EditorWidth>
        label={t("settings:editorWidth.label")}
        value={editorWidth}
        options={[
          { value: "narrow", label: t("settings:editorWidth.narrow") },
          { value: "default", label: t("settings:editorWidth.default") },
          { value: "wide", label: t("settings:editorWidth.wide") },
          { value: "full", label: t("settings:editorWidth.full") },
        ]}
        onChange={(value) => set({ editorWidth: value })}
      />
      <SegmentedControl<AutoSaveDebounceMs>
        label={t("settings:autoSave.label")}
        value={autoSaveDebounceMs}
        options={[
          { value: 500, label: t("settings:autoSave.ms500") },
          { value: 750, label: t("settings:autoSave.ms750") },
          { value: 1500, label: t("settings:autoSave.ms1500") },
          { value: 3000, label: t("settings:autoSave.ms3000") },
        ]}
        onChange={(value) => set({ autoSaveDebounceMs: value })}
      />
    </SettingsSection>
  );
}
