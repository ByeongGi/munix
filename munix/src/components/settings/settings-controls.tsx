import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import type { Language, VaultOverrideKey } from "@/store/settings-store";
import { SegmentedControl } from "@/components/ui/segmented-control";

export function SettingsSection({
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

export function LanguageSelector({
  value,
  onChange,
  label,
  description,
  options,
}: {
  value: Language;
  onChange: (value: Language) => void;
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
          onChange={(event) => onChange(event.target.value as Language)}
          className={cn(
            "rounded border px-2 py-1 text-xs",
            "border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)]",
            "text-[var(--color-text-primary)] outline-none",
            "focus:border-[var(--color-accent)]",
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
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

export function VaultOverrideRow<T extends string | number>({
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
  onSet: (value: T) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation(["settings", "common"]);
  const isOverride = override !== undefined;
  const value = override ?? globalValue;
  const globalLabel =
    options.find((option) => option.value === globalValue)?.label ??
    String(globalValue);

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
        {isOverride ? (
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
        ) : null}
      </div>
    </div>
  );
}
