import { cn } from "@/lib/cn";

interface SegmentedControlProps<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div
        className={cn(
          "inline-flex overflow-hidden rounded-md border",
          "border-[var(--color-border-primary)]",
        )}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "px-3 py-1 text-xs",
                active
                  ? "bg-[var(--color-accent)] text-[var(--color-text-on-accent)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
