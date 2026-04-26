import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface TextWidgetProps {
  value: string;
  onChange: (v: string, flush: boolean) => void;
}

export function TextWidget({ value, onChange }: TextWidgetProps) {
  const [draft, setDraft] = useState(value);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (isFocusedRef.current) return;
    setDraft(value);
  }, [value]);

  return (
    <input
      type="text"
      value={draft}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onChange={(e) => {
        setDraft(e.currentTarget.value);
        onChange(e.currentTarget.value, false);
      }}
      onBlur={(e) => {
        isFocusedRef.current = false;
        onChange(e.currentTarget.value, true);
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
