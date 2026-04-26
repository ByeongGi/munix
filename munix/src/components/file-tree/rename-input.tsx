import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

/** Rust vault::validate_name과 같은 규칙 — frontend에서 즉시 피드백.
 * 실제 검증/저장은 Rust IPC가 다시 검사하므로 여기는 UX 힌트일 뿐. */
const FORBIDDEN_CHARS = /[\\/:*?"<>|\x00-\x1f]/;
const RESERVED_RE =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.[^.]*)?$/i;

function nameError(
  value: string,
  initial: string,
  t: (key: string) => string,
): string | null {
  const v = value.trim();
  if (!v) return t("rename.emptyName");
  if (v === ".") return t("rename.dotForbidden");
  if (v === "..") return t("rename.dotDotForbidden");
  if (FORBIDDEN_CHARS.test(v)) return t("rename.forbiddenChars");
  if (RESERVED_RE.test(v)) return t("rename.windowsReserved");
  if (v.endsWith(".") || v.endsWith(" "))
    return t("rename.trailingDotOrSpace");
  if (v === initial) return null;
  return null;
}

export function RenameInput({
  initial,
  onSubmit,
  onCancel,
  existingNames,
}: {
  initial: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
  /** 같은 부모 폴더의 다른 형제 이름들 (대소문자 구분). 중복 검사용. */
  existingNames?: string[];
}) {
  const { t } = useTranslation("tree");
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const dot = initial.lastIndexOf(".");
    const end = dot > 0 ? dot : initial.length;
    ref.current?.setSelectionRange(0, end);
  }, [initial]);

  const trimmed = value.trim();
  const baseError = nameError(value, initial, t);
  const dupError =
    baseError == null &&
    trimmed !== initial &&
    existingNames?.some((n) => n === trimmed)
      ? t("rename.duplicateName")
      : null;
  const error = baseError ?? dupError;
  const isUnchanged = trimmed === initial;

  const commit = () => {
    if (error) {
      onCancel();
      return;
    }
    if (trimmed && !isUnchanged) onSubmit(trimmed);
    else onCancel();
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <span className="relative flex flex-1 min-w-0 flex-col">
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        onBlur={commit}
        aria-invalid={error ? "true" : undefined}
        className={cn(
          "min-w-0 rounded border px-1 py-0 text-sm outline-none",
          error
            ? "border-[var(--color-danger)] bg-[var(--color-bg-tertiary)]"
            : "border-[var(--color-accent)] bg-[var(--color-bg-tertiary)]",
        )}
      />
      {error && (
        <span
          role="alert"
          className={cn(
            "absolute -bottom-4 left-0 z-10 truncate rounded px-1 py-0.5 text-[10px]",
            "bg-[var(--color-bg-secondary)] text-[var(--color-danger)]",
            "border border-[var(--color-danger)]",
          )}
          style={{ maxWidth: "240px" }}
        >
          {error}
        </span>
      )}
    </span>
  );
}
