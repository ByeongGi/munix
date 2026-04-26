import { cn } from "@/lib/cn";

interface CheckboxWidgetProps {
  value: boolean;
  onChange: (v: boolean) => void;
}

export function CheckboxWidget({ value, onChange }: CheckboxWidgetProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        "inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
        value
          ? "bg-[var(--color-accent)]"
          : "border border-[var(--color-border-secondary)] bg-[var(--color-bg-tertiary)]",
      )}
    >
      <span
        className={cn(
          "h-4 w-4 rounded-full bg-white transition-transform",
          value ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}
