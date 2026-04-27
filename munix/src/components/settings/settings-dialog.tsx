import { useState } from "react";
import {
  X,
  RotateCcw,
  Settings,
  PenLine,
  Keyboard,
  SlidersHorizontal,
  Info,
  Folder,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings-store";
import { useVaultStore } from "@/store/vault-store";
import { IconButton } from "@/components/ui/icon-button";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  AboutSettingsPanel,
  AdvancedSettingsPanel,
  EditorSettingsPanel,
  GeneralSettingsPanel,
  ShortcutSettingsPanel,
  VaultSettingsPanel,
} from "@/components/settings/settings-panels";
import {
  NavGroupLabel,
  SettingsNavButton,
  type SettingsNavItem,
} from "@/components/settings/settings-nav";
import type { SettingsSectionId } from "@/components/settings/settings-types";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("general");
  const reset = useSettingsStore((s) => s.reset);
  const vaultInfo = useVaultStore((s) => s.info);
  const { t } = useTranslation(["settings", "common"]);

  if (!open) return null;

  const globalNav: SettingsNavItem[] = [
    { id: "general", label: t("settings:section.general"), icon: Settings },
    { id: "editor", label: t("settings:section.editor"), icon: PenLine },
    { id: "shortcuts", label: t("settings:section.shortcuts"), icon: Keyboard },
    {
      id: "advanced",
      label: t("settings:section.advanced"),
      icon: SlidersHorizontal,
    },
    { id: "about", label: t("settings:section.about"), icon: Info },
  ];
  const vaultNav: SettingsNavItem[] = vaultInfo
    ? [
        {
          id: "vault",
          label: t("settings:section.vault", { name: vaultInfo.name }),
          icon: Folder,
        },
      ]
    : [];
  const navItems = [...globalNav, ...vaultNav];

  return (
    <ModalShell
      onClose={onClose}
      panelClassName="flex h-[min(760px,88vh)] w-[min(1080px,94vw)] overflow-hidden"
    >
      <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)]">
        <div className="px-5 pb-3 pt-5">
          <h2 className="text-base font-semibold">{t("settings:title")}</h2>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          <NavGroupLabel label={t("settings:vaultScope.groupGlobal")} />
          {globalNav.map((item) => (
            <SettingsNavButton
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeSection === item.id}
              onClick={() => setActiveSection(item.id)}
            />
          ))}
          {vaultNav.length > 0 && (
            <>
              <NavGroupLabel
                label={t("settings:vaultScope.groupVault")}
                className="mt-3"
              />
              {vaultNav.map((item) => (
                <SettingsNavButton
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  active={activeSection === item.id}
                  onClick={() => setActiveSection(item.id)}
                />
              ))}
            </>
          )}
        </nav>
        <div className="border-t border-[var(--color-border-primary)] p-3">
          <button
            type="button"
            onClick={reset}
            className="flex h-8 w-full items-center gap-2 rounded px-2 text-xs text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t("common:resetToDefaults")}
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-[var(--color-border-primary)] px-6 py-4">
          <h3 className="text-lg font-semibold">
            {navItems.find((item) => item.id === activeSection)?.label}
          </h3>
          <IconButton
            onClick={onClose}
            label={t("common:close")}
            size="sm"
            icon={<X className="h-4 w-4" />}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {activeSection === "general" ? <GeneralSettingsPanel /> : null}
          {activeSection === "editor" ? <EditorSettingsPanel /> : null}
          {activeSection === "shortcuts" ? <ShortcutSettingsPanel /> : null}
          {activeSection === "advanced" ? <AdvancedSettingsPanel /> : null}
          {activeSection === "about" ? <AboutSettingsPanel /> : null}
          {activeSection === "vault" ? <VaultSettingsPanel /> : null}
        </div>
      </main>
    </ModalShell>
  );
}
