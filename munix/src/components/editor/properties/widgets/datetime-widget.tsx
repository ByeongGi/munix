import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { DatePickerPopover } from "./date-picker-popover";

interface DatetimeWidgetProps {
  value: string | Date | null;
  onChange: (v: string, flush: boolean) => void;
}

function toDatetimeLocal(v: string | Date | null): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 16);
  // "YYYY-MM-DDTHH:mm:ss..." → take first 16 chars
  return v.slice(0, 16);
}

export function DatetimeWidget({ value, onChange }: DatetimeWidgetProps) {
  const [draft, setDraft] = useState(toDatetimeLocal(value));
  const isFocusedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocusedRef.current) return;
    setDraft(toDatetimeLocal(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative",
        "flex h-6 w-full cursor-pointer items-center gap-1.5 rounded border px-1.5",
        "border-[var(--color-border-secondary)] bg-[var(--color-bg-secondary)]",
        "hover:border-[var(--color-border-primary)]",
        "focus-within:border-[var(--color-accent)] focus-within:bg-[var(--color-bg-tertiary)]",
      )}
      onClick={() => setOpen(true)}
    >
      <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onFocus={() => {
          isFocusedRef.current = true;
          setOpen(true);
        }}
        onChange={(e) => {
          setDraft(e.currentTarget.value);
          onChange(e.currentTarget.value, false);
        }}
        onBlur={(e) => {
          isFocusedRef.current = false;
          onChange(e.currentTarget.value, true);
        }}
        className={cn(
          "min-w-0 flex-1 cursor-pointer bg-transparent text-xs outline-none",
          "text-[var(--color-text-primary)]",
        )}
      />
      {open && (
        <DatePickerPopover
          value={draft}
          withTime
          onCancel={() => setOpen(false)}
          onCommit={(next) => {
            setDraft(next);
            onChange(next, true);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
