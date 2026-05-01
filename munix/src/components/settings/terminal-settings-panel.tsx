import { useTranslation } from "react-i18next";

import { useSettingsStore } from "@/store/settings-store";
import {
  RangeControl,
  SettingsSection,
  ToggleControl,
} from "./settings-controls";

export function TerminalSettingsPanel() {
  const terminalBackgroundOpacity = useSettingsStore(
    (state) => state.terminalBackgroundOpacity,
  );
  const terminalFontSize = useSettingsStore((state) => state.terminalFontSize);
  const terminalLineHeight = useSettingsStore(
    (state) => state.terminalLineHeight,
  );
  const terminalCursorBlink = useSettingsStore(
    (state) => state.terminalCursorBlink,
  );
  const terminalScrollback = useSettingsStore(
    (state) => state.terminalScrollback,
  );
  const set = useSettingsStore((state) => state.set);
  const { t } = useTranslation(["settings"]);

  return (
    <SettingsSection title={t("settings:section.terminal")}>
      <RangeControl
        label={t("settings:terminalFontSize.label")}
        description={t("settings:terminalFontSize.description")}
        value={terminalFontSize}
        min={10}
        max={24}
        valueLabel={t("settings:terminalFontSize.value", {
          value: terminalFontSize,
        })}
        onChange={(value) => set({ terminalFontSize: value })}
      />
      <RangeControl
        label={t("settings:terminalLineHeight.label")}
        description={t("settings:terminalLineHeight.description")}
        value={terminalLineHeight}
        min={100}
        max={160}
        step={2}
        valueLabel={t("settings:terminalLineHeight.value", {
          value: terminalLineHeight,
        })}
        onChange={(value) => set({ terminalLineHeight: value })}
      />
      <RangeControl
        label={t("settings:terminalScrollback.label")}
        description={t("settings:terminalScrollback.description")}
        value={terminalScrollback}
        min={1000}
        max={50000}
        step={1000}
        valueLabel={t("settings:terminalScrollback.value", {
          value: terminalScrollback.toLocaleString(),
        })}
        onChange={(value) => set({ terminalScrollback: value })}
      />
      <RangeControl
        label={t("settings:terminalBackgroundOpacity.label")}
        description={t("settings:terminalBackgroundOpacity.description")}
        value={terminalBackgroundOpacity}
        min={0}
        max={100}
        valueLabel={t("settings:terminalBackgroundOpacity.value", {
          value: terminalBackgroundOpacity,
        })}
        onChange={(value) => set({ terminalBackgroundOpacity: value })}
      />
      <ToggleControl
        label={t("settings:terminalCursorBlink.label")}
        description={t("settings:terminalCursorBlink.description")}
        checked={terminalCursorBlink}
        onChange={(value) => set({ terminalCursorBlink: value })}
      />
    </SettingsSection>
  );
}
