import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import { KeymapSettings } from "@/components/keymap-settings";
import {
  useSettingsStore,
  type AutoSaveDebounceMs,
  type EditorWidth,
  type FontSize,
} from "@/store/settings-store";
import { useThemeStore, type ThemeMode } from "@/store/theme-store";
import { useVaultStore } from "@/store/vault-store";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  LanguageSelector,
  SettingsSection,
  VaultOverrideRow,
} from "./settings-controls";

export function GeneralSettingsPanel() {
  const language = useSettingsStore((state) => state.language);
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
    </SettingsSection>
  );
}

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

export function ShortcutSettingsPanel() {
  const { t } = useTranslation(["settings", "common"]);

  return (
    <SettingsSection title={t("settings:section.shortcuts")}>
      <KeymapSettings />
    </SettingsSection>
  );
}

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

export function VaultSettingsPanel() {
  const globalSettings = useSettingsStore((state) => state.globalSettings);
  const vaultOverride = useSettingsStore((state) => state.vaultOverride);
  const setVaultOverride = useSettingsStore((state) => state.setVaultOverride);
  const clearVaultOverride = useSettingsStore(
    (state) => state.clearVaultOverride,
  );
  const vaultInfo = useVaultStore((state) => state.info);
  const { t } = useTranslation(["settings", "common"]);

  return (
    <SettingsSection
      title={
        vaultInfo
          ? t("settings:section.vault", { name: vaultInfo.name })
          : t("settings:section.vault", { name: "—" })
      }
    >
      {!vaultInfo ? (
        <p className="text-[11px] text-[var(--color-text-tertiary)]">
          {t("settings:vaultScope.noActive")}
        </p>
      ) : (
        <>
          <p className="text-[11px] text-[var(--color-text-tertiary)]">
            {t("settings:vaultScope.description")}
          </p>
          <VaultOverrideRow<FontSize>
            label={t("settings:fontSize.label")}
            keyName="fontSize"
            override={vaultOverride.fontSize}
            globalValue={globalSettings.fontSize}
            options={[
              { value: "sm", label: t("settings:fontSize.sm") },
              { value: "base", label: t("settings:fontSize.base") },
              { value: "lg", label: t("settings:fontSize.lg") },
              { value: "xl", label: t("settings:fontSize.xl") },
            ]}
            onSet={(value) => setVaultOverride({ fontSize: value })}
            onClear={() => clearVaultOverride("fontSize")}
          />
          <VaultOverrideRow<EditorWidth>
            label={t("settings:editorWidth.label")}
            keyName="editorWidth"
            override={vaultOverride.editorWidth}
            globalValue={globalSettings.editorWidth}
            options={[
              { value: "narrow", label: t("settings:editorWidth.narrow") },
              { value: "default", label: t("settings:editorWidth.default") },
              { value: "wide", label: t("settings:editorWidth.wide") },
              { value: "full", label: t("settings:editorWidth.full") },
            ]}
            onSet={(value) => setVaultOverride({ editorWidth: value })}
            onClear={() => clearVaultOverride("editorWidth")}
          />
          <VaultOverrideRow<AutoSaveDebounceMs>
            label={t("settings:autoSave.label")}
            keyName="autoSaveDebounceMs"
            override={vaultOverride.autoSaveDebounceMs}
            globalValue={globalSettings.autoSaveDebounceMs}
            options={[
              { value: 500, label: t("settings:autoSave.ms500") },
              { value: 750, label: t("settings:autoSave.ms750") },
              { value: 1500, label: t("settings:autoSave.ms1500") },
              { value: 3000, label: t("settings:autoSave.ms3000") },
            ]}
            onSet={(value) => setVaultOverride({ autoSaveDebounceMs: value })}
            onClear={() => clearVaultOverride("autoSaveDebounceMs")}
          />
        </>
      )}
    </SettingsSection>
  );
}
