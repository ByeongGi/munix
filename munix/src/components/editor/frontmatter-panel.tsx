import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/cn";

type FmRecord = Record<string, unknown>;

function toDisplayValue(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

const arrayKeys = new Set(["tags", "aliases", "keywords"]);

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === "string");
}

function isEditableValue(v: unknown): boolean {
  return (
    v == null ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean" ||
    isStringArray(v)
  );
}

function parseValue(key: string, raw: string, previous: unknown): unknown {
  const trimmed = raw.trim();
  // tags/aliases 같은 배열 후보는 쉼표 분리
  if (arrayKeys.has(key) || Array.isArray(previous)) {
    if (!trimmed) return [];
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof previous === "boolean") return trimmed === "true";
  if (typeof previous === "number") {
    const next = Number(trimmed);
    return Number.isNaN(next) ? previous : next;
  }
  return trimmed;
}

type FieldKind = "date" | "number" | "boolean" | "text";

const DATE_KEY_RE =
  /^(date|created|updated|modified|published|publish|due|deadline|start|end)$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 값과 키 이름으로 입력 UI를 분기. 자동 추정이라 100% 정확하진 않지만
 * 보편 케이스를 빠르게 커버. 사용자가 텍스트로 강제하고 싶으면 값을 따옴표로 감쌈. */
function fieldKind(key: string, value: unknown): FieldKind {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "text"; // 쉼표 분리 텍스트로 표시
  if (typeof value === "string") {
    if (DATE_KEY_RE.test(key)) return "date";
    if (ISO_DATE_RE.test(value)) return "date";
  }
  return "text";
}

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
    if (!isEditableValue(previous)) return;
    const parsed = parseValue(key, raw, previous);
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
                  const kind = fieldKind(key, value);
                  return (
                    <tr key={key} className="group">
                      <td className="w-40 py-1 pr-2 align-top">
                        <span className="font-mono text-xs text-[var(--color-accent)]">
                          {key}
                        </span>
                      </td>
                      <td className="py-1">
                        <FieldInput
                          value={value}
                          kind={kind}
                          editable={isEditableValue(value)}
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
                          aria-label={t("editor:frontmatter.removeField", { key })}
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

/** 값의 종류에 따라 적절한 입력 UI 렌더. boolean은 체크박스 토글, 나머지는 input type 분기. */
function FieldInput({
  value,
  kind,
  editable,
  onCommit,
}: {
  value: unknown;
  kind: FieldKind;
  editable: boolean;
  onCommit: (raw: string, flush: boolean) => void;
}) {
  const [draft, setDraft] = useState(toDisplayValue(value));
  // focus 중에는 외부 value 변경으로 draft를 덮어쓰지 않음.
  // 이유: 배열 필드(tags 등)에 "123," 입력 시 onChange → parseValue → setFrontmatter
  // 가 split/filter로 ["123"]로 정규화 → 다시 toDisplayValue → "123" 으로 draft 리셋되며
  // 사용자가 친 ","가 사라지는 문제. focus 중일 때는 사용자 입력이 진실의 원천.
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (isFocusedRef.current) return;
    setDraft(toDisplayValue(value));
  }, [value]);

  if (kind === "boolean") {
    const checked = value === true;
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCommit(checked ? "false" : "true", true)}
        className={cn(
          "inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked
            ? "bg-[var(--color-accent)]"
            : "bg-[var(--color-bg-tertiary)] border border-[var(--color-border-secondary)]",
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </button>
    );
  }

  const inputType =
    kind === "date" ? "date" : kind === "number" ? "number" : "text";

  return (
    <input
      type={inputType}
      value={draft}
      readOnly={!editable}
      title={!editable ? "Complex YAML values are read-only in this panel." : undefined}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onChange={(e) => {
        setDraft(e.currentTarget.value);
        onCommit(e.currentTarget.value, false);
      }}
      onBlur={(e) => {
        isFocusedRef.current = false;
        onCommit(e.currentTarget.value, true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className={cn(
        "w-full rounded border px-1.5 py-0.5 text-xs outline-none",
        "border-transparent bg-transparent",
        "focus:border-[var(--color-border-primary)] focus:bg-[var(--color-bg-tertiary)]",
        !editable && "text-[var(--color-text-tertiary)]",
      )}
    />
  );
}
