import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { groupedRegistry, type KeymapEntry } from "@/lib/keymap-registry";
import { formatKeymap, isMac } from "@/lib/keymap-format";
import { useEffectiveKeymap } from "@/hooks/use-keymap";

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface DisplayItem {
  /** 표시용 키 문자열 (이미 OS-aware 포맷됨). */
  keys: string;
  /** 명령 설명. */
  action: string;
}

interface DisplayGroup {
  /** 그룹 ID — registry group 또는 settings:shortcuts.groups 의 키. */
  groupKey: string;
  /** 표시용 그룹 라벨 (이미 t() 적용됨). */
  title: string;
  items: DisplayItem[];
}

/**
 * registry 외 동적/컨텍스트 키 목록.
 *
 * 각 entry 는 i18n 키만 들고 있고, 실제 표시 텍스트는 호출부에서 t() 로 lookup.
 * `groupKey` 는 `settings:shortcuts.groups.<key>`, `i18nKey` 는
 * `settings:shortcuts.static.<i18nKey>` 의 `keys` / `action` 필드를 가리킨다.
 *
 * 동적 토큰 (예: `{{mod}}` ) 은 t() interpolation 으로 치환.
 */
const STATIC_GROUPS: Array<{
  groupKey: string;
  items: Array<{ i18nKey: string; vars?: Record<string, string> }>;
}> = [
  {
    groupKey: "tabs",
    items: [{ i18nKey: "tabs.nthTab" }],
  },
  {
    groupKey: "fileTree",
    items: [
      { i18nKey: "fileTree.move" },
      { i18nKey: "fileTree.expand" },
      { i18nKey: "fileTree.collapse" },
      { i18nKey: "fileTree.openOrToggle" },
    ],
  },
  {
    groupKey: "table",
    items: [
      { i18nKey: "table.selectAll" },
      { i18nKey: "table.cellMove" },
      { i18nKey: "table.cellMenu" },
    ],
  },
  {
    groupKey: "codeBlock",
    items: [
      { i18nKey: "codeBlock.indent" },
      { i18nKey: "codeBlock.outdent" },
      { i18nKey: "codeBlock.copy" },
    ],
  },
  {
    groupKey: "markdownExt",
    items: [
      { i18nKey: "markdownExt.highlight" },
      { i18nKey: "markdownExt.wikilink" },
      { i18nKey: "markdownExt.inlineKatex" },
      { i18nKey: "markdownExt.blockKatex" },
      { i18nKey: "markdownExt.footnote" },
    ],
  },
  {
    groupKey: "slashMenu",
    items: [
      { i18nKey: "slashMenu.open" },
      { i18nKey: "slashMenu.move" },
      { i18nKey: "slashMenu.select" },
      { i18nKey: "slashMenu.close" },
    ],
  },
  {
    groupKey: "inFileSearch",
    items: [{ i18nKey: "inFileSearch.next" }, { i18nKey: "inFileSearch.close" }],
  },
];

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  const { t } = useTranslation(["settings", "common"]);
  const [query, setQuery] = useState("");
  const effective = useEffectiveKeymap();

  const groups = useMemo<DisplayGroup[]>(() => {
    // 1. registry 그룹 → display 그룹 변환 (override 반영).
    const registryGroups: DisplayGroup[] = groupedRegistry().map(
      ({ group, items }) => ({
        groupKey: group,
        title: t(`settings:shortcuts.groups.${group}`),
        items: items.map(
          (entry: KeymapEntry): DisplayItem => ({
            keys: formatKeymap(effective.get(entry.id) ?? entry.defaultKey),
            action: t(`settings:shortcuts.commands.${entry.id}.description`),
          }),
        ),
      }),
    );

    // 2. registry 외 동적/컨텍스트 키 합치기.
    const mac = isMac();
    const modSymbol = mac ? "⌘" : "Ctrl";
    const staticDisplayGroups: DisplayGroup[] = STATIC_GROUPS.map((g) => ({
      groupKey: g.groupKey,
      title: t(`settings:shortcuts.groups.${g.groupKey}`),
      items: g.items.map((it) => ({
        keys: t(`settings:shortcuts.static.${it.i18nKey}.keys`, {
          mod: modSymbol,
          ...(it.vars ?? {}),
        }),
        action: t(`settings:shortcuts.static.${it.i18nKey}.action`),
      })),
    }));

    // 3. 같은 groupKey 끼리 합치기 (registry 와 static 양쪽에 있을 수 있음).
    const merged: DisplayGroup[] = [];
    for (const g of [...registryGroups, ...staticDisplayGroups]) {
      const found = merged.find((m) => m.groupKey === g.groupKey);
      if (found) found.items = [...found.items, ...g.items];
      else merged.push({ ...g, items: [...g.items] });
    }
    return merged;
  }, [effective, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            it.keys.toLowerCase().includes(q) ||
            it.action.toLowerCase().includes(q) ||
            g.title.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border shadow-2xl",
          "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]",
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border-primary)] px-5 py-3">
          <h2 className="text-base font-semibold">
            {t("settings:shortcuts.dialog.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]"
            aria-label={t("common:close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 border-b border-[var(--color-border-primary)] px-5 py-2">
          <Search className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("settings:shortcuts.dialog.searchPlaceholder")}
            className={cn(
              "flex-1 bg-transparent text-sm outline-none",
              "placeholder:text-[var(--color-text-tertiary)]",
            )}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              aria-label={t("settings:shortcuts.dialog.clear")}
            >
              {t("settings:shortcuts.dialog.clear")}
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-[var(--color-text-tertiary)]">
              {t("settings:shortcuts.dialog.noResults", { query })}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2">
              {filtered.map((g) => (
                <section key={g.groupKey}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                    {g.title}
                  </h3>
                  <ul className="space-y-1.5 text-sm">
                    {g.items.map((s) => (
                      <li
                        key={s.keys + s.action}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-[var(--color-text-secondary)]">
                          {s.action}
                        </span>
                        <kbd
                          className={cn(
                            "rounded border px-1.5 py-0.5 font-mono text-[11px]",
                            "border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)]",
                            "text-[var(--color-text-primary)]",
                          )}
                        >
                          {s.keys}
                        </kbd>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
