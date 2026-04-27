import { useTranslation } from "react-i18next";

import {
  useSettingsStore,
  type AutoSaveDebounceMs,
  type EditorWidth,
  type FontSize,
} from "@/store/settings-store";
import { useVaultStore } from "@/store/vault-store";
import { SettingsSection, VaultOverrideRow } from "./settings-controls";

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
