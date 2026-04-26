import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  KEYMAP_REGISTRY,
  groupedRegistry,
  type KeymapEntry,
} from "@/lib/keymap-registry";
import { formatKeymap } from "@/lib/keymap-format";
import { useSettingsStore } from "@/store/settings-store";
import { findConflicts } from "@/hooks/use-keymap";
import { KeyCapture } from "./key-capture";

/**
 * 단축키 설정 섹션. settings-dialog 안에서 렌더된다.
 *
 * - 그룹별로 entry 행 표시. editable=false 인 entry 는 회색조 + "기본" 만 표기.
 * - 각 행 상태: idle (현재 키 + "변경" / "기본값") | capturing (KeyCapture)
 * - 충돌은 store 기반으로 계산해서 인라인 경고 표기. 같은 키를 두 entry 가
 *   override 한 경우만 보여주며, 같은 scope 의 default 와 동일하게 매핑되는 것도 충돌.
 * - "전체 기본값 복원" 버튼은 confirm prompt 로 확인.
 *
 * **i18n**: description / group 라벨 / UI 문자열 모두 `settings` namespace 의
 * `shortcuts.*` 키에서 lookup. registry entry 자체에는 description 이 없다.
 */
export function KeymapSettings() {
  const { t } = useTranslation(["settings"]);
  const overrides = useSettingsStore((s) => s.keymapOverrides);
  const setStore = useSettingsStore((s) => s.set);
  const [capturingId, setCapturingId] = useState<string | null>(null);

  const groups = useMemo(() => groupedRegistry(), []);

  const conflicts = useMemo(() => findConflicts(overrides), [overrides]);
  const conflictByEntry = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of conflicts) {
      for (const id of c.ids) {
        const others = c.ids.filter((x) => x !== id);
        map.set(id, others);
      }
    }
    return map;
  }, [conflicts]);

  const updateOverride = (id: string, key: string | null) => {
    const entry = KEYMAP_REGISTRY.find((e) => e.id === id);
    if (!entry) return;
    const next = { ...overrides };
    if (key == null || key === entry.defaultKey) {
      delete next[id];
    } else {
      next[id] = key;
    }
    setStore({ keymapOverrides: next });
  };

  const resetAll = () => {
    if (Object.keys(overrides).length === 0) return;
    const ok = window.confirm(t("settings:shortcuts.settings.resetAllConfirm"));
    if (!ok) return;
    setStore({ keymapOverrides: {} });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-[var(--color-text-tertiary)]">
          {t("settings:shortcuts.settings.hint")}
        </p>
        <button
          type="button"
          onClick={resetAll}
          disabled={Object.keys(overrides).length === 0}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-xs",
            "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <RotateCcw className="h-3 w-3" />
          {t("settings:shortcuts.settings.resetAll")}
        </button>
      </div>

      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.group}>
            <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
              {t(`settings:shortcuts.groups.${g.group}`)}
            </h4>
            <ul className="space-y-1">
              {g.items.map((entry) => (
                <ShortcutRow
                  key={entry.id}
                  entry={entry}
                  override={overrides[entry.id]}
                  capturing={capturingId === entry.id}
                  conflictWith={conflictByEntry.get(entry.id) ?? []}
                  onStartCapture={() => setCapturingId(entry.id)}
                  onCancelCapture={() => setCapturingId(null)}
                  onSubmit={(key) => {
                    updateOverride(entry.id, key);
                    setCapturingId(null);
                  }}
                  onResetOne={() => updateOverride(entry.id, null)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

interface ShortcutRowProps {
  entry: KeymapEntry;
  override: string | undefined;
  capturing: boolean;
  conflictWith: string[];
  onStartCapture: () => void;
  onCancelCapture: () => void;
  onSubmit: (key: string) => void;
  onResetOne: () => void;
}

function ShortcutRow({
  entry,
  override,
  capturing,
  conflictWith,
  onStartCapture,
  onCancelCapture,
  onSubmit,
  onResetOne,
}: ShortcutRowProps) {
  const { t } = useTranslation(["settings"]);
  const currentKey = override ?? entry.defaultKey;
  const isOverridden = override !== undefined && override !== entry.defaultKey;

  return (
    <li className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-[var(--color-bg-hover)]/50">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-[var(--color-text-primary)]">
          {t(`settings:shortcuts.commands.${entry.id}.description`)}
          {!entry.editable && (
            <span className="ml-1 text-[10px] text-[var(--color-text-tertiary)]">
              {t("settings:shortcuts.settings.readOnlyTag")}
            </span>
          )}
        </div>
        {conflictWith.length > 0 && (
          <div className="text-[10px] text-[var(--color-warning)]">
            {t("settings:shortcuts.settings.conflictLabel")}:{" "}
            {conflictWith
              .map((id) =>
                t(`settings:shortcuts.commands.${id}.description`, {
                  defaultValue: id,
                }),
              )
              .join(", ")}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {capturing ? (
          <KeyCapture
            initial={currentKey}
            onCancel={onCancelCapture}
            onSubmit={onSubmit}
          />
        ) : (
          <kbd
            className={cn(
              "rounded border px-1.5 py-0.5 font-mono text-[11px]",
              "border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)]",
              isOverridden
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-primary)]",
            )}
          >
            {formatKeymap(currentKey)}
          </kbd>
        )}
        {entry.editable && !capturing && (
          <button
            type="button"
            onClick={onStartCapture}
            className="rounded border border-[var(--color-border-primary)] px-2 py-0.5 text-[11px] hover:bg-[var(--color-bg-hover)]"
          >
            {t("settings:shortcuts.settings.change")}
          </button>
        )}
        {entry.editable && isOverridden && !capturing && (
          <button
            type="button"
            onClick={onResetOne}
            title={t("settings:shortcuts.settings.resetOneTitle")}
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
    </li>
  );
}
