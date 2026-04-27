import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import {
  type FrontmatterFieldKind,
  toFrontmatterDisplayValue,
} from "./frontmatter-values";

export function FrontmatterFieldInput({
  value,
  kind,
  editable,
  onCommit,
}: {
  value: unknown;
  kind: FrontmatterFieldKind;
  editable: boolean;
  onCommit: (raw: string, flush: boolean) => void;
}) {
  const [draft, setDraft] = useState(toFrontmatterDisplayValue(value));
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (isFocusedRef.current) return;
    setDraft(toFrontmatterDisplayValue(value));
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
      title={
        !editable
          ? "Complex YAML values are read-only in this panel."
          : undefined
      }
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
          e.currentTarget.blur();
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
