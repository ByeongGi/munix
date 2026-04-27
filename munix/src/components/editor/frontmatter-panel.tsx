import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/cn";
import { FrontmatterFieldInput } from "./frontmatter-field-input";
import {
  frontmatterFieldKind,
  isEditableFrontmatterValue,
  parseFrontmatterValue,
} from "./frontmatter-values";

type FmRecord = Record<string, unknown>;

export function FrontmatterPanel() {
  const { t } = useTranslation(["editor"]);
  const currentPath = useEditorStore((s) => s.currentPath);
  const frontmatter = useEditorStore((s) => s.frontmatter);
  const setFrontmatter = useEditorStore((s) => s.setFrontmatter);
  const [open, setOpen] = useState(false);
  const [newKey, setNewKey] = useState("");

  const entries = useMemo(() => {
    if (!frontmatter) return [];
    return Object.entries(frontmatter) as [string, unknown][];
  }, [frontmatter]);

  if (!currentPath) return null;

  const triggerSave = (flush = false) => {
    const store = useEditorStore.getState();
    store.requestSave?.();
    if (flush) void store.flushSave?.();
  };

  const updateField = (key: string, raw: string, flush = false) => {
    const previous = frontmatter?.[key];
    if (!isEditableFrontmatterValue(previous)) return;
    const parsed = parseFrontmatterValue(key, raw, previous);
    const next: FmRecord = { ...(frontmatter ?? {}) } as FmRecord;
    next[key] = parsed;
    setFrontmatter(next);
    triggerSave(flush);
  };

  const removeField = (key: string) => {
    if (!frontmatter) return;
    const next: FmRecord = { ...(frontmatter as FmRecord) };
    delete next[key];
    setFrontmatter(Object.keys(next).length === 0 ? null : next);
    triggerSave(true);
  };

  const addField = () => {
    const k = newKey.trim();
    if (!k) return;
    if (frontmatter && k in frontmatter) {
      setNewKey("");
      return;
    }
    const next: FmRecord = { ...(frontmatter ?? {}) } as FmRecord;
    next[k] = "";
    setFrontmatter(next);
    setNewKey("");
    triggerSave(true);
  };

  const hasAny = entries.length > 0;

  return (
    <div
      className={cn(
        "mx-12 my-4 rounded-md border",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 text-xs",
          "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]",
        )}
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span className="font-mono uppercase tracking-wide">Frontmatter</span>
        {hasAny && !open && (
          <span className="ml-auto text-[10px]">
            {t("editor:frontmatter.fieldCount", { count: entries.length })}
          </span>
        )}
      </button>
      {open && (
        <div className="border-t border-[var(--color-border-primary)] px-3 py-2">
          {!hasAny && (
            <p className="mb-2 text-[11px] text-[var(--color-text-tertiary)]">
              {t("editor:frontmatter.empty")}
            </p>
          )}
          {hasAny && (
            <table className="w-full text-sm">
              <tbody>
                {entries.map(([key, value]) => {
                  const kind = frontmatterFieldKind(key, value);
                  return (
                    <tr key={key} className="group">
                      <td className="w-40 py-1 pr-2 align-top">
                        <span className="font-mono text-xs text-[var(--color-accent)]">
                          {key}
                        </span>
                      </td>
                      <td className="py-1">
                        <FrontmatterFieldInput
                          value={value}
                          kind={kind}
                          editable={isEditableFrontmatterValue(value)}
                          onCommit={(raw, flush) =>
                            updateField(key, raw, flush)
                          }
                        />
                      </td>
                      <td className="w-6 py-1 pl-1 align-middle">
                        <button
                          type="button"
                          onClick={() => removeField(key)}
                          className="hidden rounded p-0.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] group-hover:block"
                          aria-label={t("editor:frontmatter.removeField", {
                            key,
                          })}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="mt-2 flex items-center gap-1">
            <input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addField();
                }
              }}
              placeholder={t("editor:frontmatter.newFieldPlaceholder")}
              className={cn(
                "flex-1 rounded border px-1.5 py-0.5 text-xs outline-none",
                "border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)]",
                "focus:border-[var(--color-accent)]",
              )}
            />
            <button
              type="button"
              onClick={addField}
              className="flex h-6 items-center gap-1 rounded px-2 text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
            >
              <Plus className="h-3 w-3" /> {t("editor:frontmatter.addField")}
            </button>
          </div>
          <p className="mt-2 text-[10px] text-[var(--color-text-tertiary)]">
            {t("editor:frontmatter.hint")}
          </p>
        </div>
      )}
    </div>
  );
}
