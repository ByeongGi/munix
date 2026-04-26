import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface NumberWidgetProps {
  value: number | null;
  onChange: (v: number | null, flush: boolean) => void;
}

export function NumberWidget({ value, onChange }: NumberWidgetProps) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (isFocusedRef.current) return;
    setDraft(value != null ? String(value) : "");
  }, [value]);

  const commit = (raw: string, flush: boolean) => {
    const parsed = parseFloat(raw);
    onChange(Number.isNaN(parsed) ? null : parsed, flush);
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      value={draft}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onChange={(e) => {
        setDraft(e.currentTarget.value);
        commit(e.currentTarget.value, false);
      }}
      onBlur={(e) => {
        isFocusedRef.current = false;
        commit(e.currentTarget.value, true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className={cn(
        "h-6 w-full rounded border px-1.5 text-xs outline-none",
        "border-[var(--color-border-secondary)] bg-[var(--color-bg-secondary)]",
        "hover:border-[var(--color-border-primary)]",
        "focus:border-[var(--color-accent)] focus:bg-[var(--color-bg-tertiary)]",
      )}
    />
  );
}
