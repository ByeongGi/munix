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
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useSettingsStore,
  type FontSize,
  type EditorWidth,
  type AutoSaveDebounceMs,
  type Language,
  type VaultOverrideKey,
} from "@/store/settings-store";
import { useVaultStore } from "@/store/vault-store";
import { useThemeStore, type ThemeMode } from "@/store/theme-store";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/icon-button";
import { ModalShell } from "@/components/ui/modal-shell";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { KeymapSettings } from "./keymap-settings";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

type SettingsSectionId =
  | "general"
  | "editor"
  | "shortcuts"
  | "advanced"
  | "about"
  | "vault";

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("general");
  const fontSize = useSettingsStore((s) => s.fontSize);
  const editorWidth = useSettingsStore((s) => s.editorWidth);
  const autoSaveDebounceMs = useSettingsStore((s) => s.autoSaveDebounceMs);
  const customCss = useSettingsStore((s) => s.customCss);
  const language = useSettingsStore((s) => s.language);
  const globalSettings = useSettingsStore((s) => s.globalSettings);
  const vaultOverride = useSettingsStore((s) => s.vaultOverride);
  const set = useSettingsStore((s) => s.set);
  const reset = useSettingsStore((s) => s.reset);
  const setVaultOverride = useSettingsStore((s) => s.setVaultOverride);
  const clearVaultOverride = useSettingsStore((s) => s.clearVaultOverride);
  const vaultInfo = useVaultStore((s) => s.info);
  const theme = useThemeStore((s) => s.mode);
  const setTheme = useThemeStore((s) => s.set);
  const { t } = useTranslation(["settings", "common"]);

  if (!open) return null;

  const globalNav: Array<{
    id: SettingsSectionId;
    label: string;
    icon: LucideIcon;
  }> = [
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
  const vaultNav: Array<{
    id: SettingsSectionId;
    label: string;
    icon: LucideIcon;
  }> = vaultInfo
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
          {activeSection === "general" && (
            <Section title={t("settings:section.appearance")}>
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
                onChange={(v) => set({ language: v })}
                label={t("settings:language.label")}
                description={t("settings:language.description")}
                options={[
                  { value: "auto", label: t("settings:language.auto") },
                  { value: "ko", label: t("settings:language.ko") },
                  { value: "en", label: t("settings:language.en") },
                ]}
              />
            </Section>
          )}

          {activeSection === "editor" && (
            <Section title={t("settings:section.editor")}>
              <SegmentedControl<FontSize>
                label={t("settings:fontSize.label")}
                value={fontSize}
                options={[
                  { value: "sm", label: t("settings:fontSize.sm") },
                  { value: "base", label: t("settings:fontSize.base") },
                  { value: "lg", label: t("settings:fontSize.lg") },
                  { value: "xl", label: t("settings:fontSize.xl") },
                ]}
                onChange={(v) => set({ fontSize: v })}
              />
              <SegmentedControl<EditorWidth>
                label={t("settings:editorWidth.label")}
                value={editorWidth}
                options={[
                  {
                    value: "narrow",
                    label: t("settings:editorWidth.narrow"),
                  },
                  {
                    value: "default",
                    label: t("settings:editorWidth.default"),
                  },
                  { value: "wide", label: t("settings:editorWidth.wide") },
                  { value: "full", label: t("settings:editorWidth.full") },
                ]}
                onChange={(v) => set({ editorWidth: v })}
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
                onChange={(v) => set({ autoSaveDebounceMs: v })}
              />
            </Section>
          )}

          {activeSection === "shortcuts" && (
            <Section title={t("settings:section.shortcuts")}>
              <KeymapSettings />
            </Section>
          )}

          {activeSection === "advanced" && (
            <Section title={t("settings:section.advanced")}>
              <p className="text-[11px] text-[var(--color-text-tertiary)]">
                {t("settings:customCss.description")}
              </p>
              <textarea
                value={customCss}
                onChange={(e) => set({ customCss: e.target.value })}
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
            </Section>
          )}

          {activeSection === "about" && (
            <Section title={t("settings:section.about")}>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {t("settings:about.tagline")}
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                {t("settings:about.meta")}
              </p>
            </Section>
          )}

          {activeSection === "vault" && (
            <Section
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
                    onSet={(v) => setVaultOverride({ fontSize: v })}
                    onClear={() => clearVaultOverride("fontSize")}
                  />
                  <VaultOverrideRow<EditorWidth>
                    label={t("settings:editorWidth.label")}
                    keyName="editorWidth"
                    override={vaultOverride.editorWidth}
                    globalValue={globalSettings.editorWidth}
                    options={[
                      {
                        value: "narrow",
                        label: t("settings:editorWidth.narrow"),
                      },
                      {
                        value: "default",
                        label: t("settings:editorWidth.default"),
                      },
                      { value: "wide", label: t("settings:editorWidth.wide") },
                      { value: "full", label: t("settings:editorWidth.full") },
                    ]}
                    onSet={(v) => setVaultOverride({ editorWidth: v })}
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
                    onSet={(v) => setVaultOverride({ autoSaveDebounceMs: v })}
                    onClear={() => clearVaultOverride("autoSaveDebounceMs")}
                  />
                </>
              )}
            </Section>
          )}
        </div>
      </main>
    </ModalShell>
  );
}

function NavGroupLabel({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-2 pb-1 pt-1 text-[10px] font-mono uppercase tracking-wide",
        "text-[var(--color-text-tertiary)]",
        className,
      )}
    >
      {label}
    </div>
  );
}

function SettingsNavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded px-2 text-sm",
        active
          ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function VaultOverrideRow<T extends string | number>({
  label,
  keyName: _keyName,
  override,
  globalValue,
  options,
  onSet,
  onClear,
}: {
  label: string;
  keyName: VaultOverrideKey;
  override: T | undefined;
  globalValue: T;
  options: { value: T; label: string }[];
  onSet: (v: T) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation(["settings", "common"]);
  const isOverride = override !== undefined;
  const value = override ?? globalValue;
  const globalLabel =
    options.find((o) => o.value === globalValue)?.label ?? String(globalValue);
  return (
    <div className="space-y-1">
      <SegmentedControl
        label={label}
        value={value}
        options={options}
        onChange={onSet}
      />
      <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-tertiary)]">
        <span>
          {isOverride ? (
            <>
              <span className="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 font-mono uppercase text-[9px] text-[var(--color-accent)]">
                {t("settings:vaultScope.overrideActive")}
              </span>
              <span className="ml-2">
                {t("settings:vaultScope.globalLabel")} {globalLabel}
              </span>
            </>
          ) : (
            <span>
              {t("settings:vaultScope.usingGlobal")} ({globalLabel})
            </span>
          )}
        </span>
        {isOverride && (
          <button
            type="button"
            onClick={onClear}
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
              "hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]",
            )}
          >
            <RotateCcw className="h-3 w-3" />
            {t("settings:vaultScope.resetToGlobal")}
          </button>
        )}
      </div>
    </div>
  );
}

function LanguageSelector({
  value,
  onChange,
  label,
  description,
  options,
}: {
  value: Language;
  onChange: (v: Language) => void;
  label: string;
  description: string;
  options: { value: Language; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">{label}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as Language)}
          className={cn(
            "rounded border px-2 py-1 text-xs",
            "border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)]",
            "text-[var(--color-text-primary)] outline-none",
            "focus:border-[var(--color-accent)]",
          )}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <p className="text-[11px] text-[var(--color-text-tertiary)]">
        {description}
      </p>
    </div>
  );
}
