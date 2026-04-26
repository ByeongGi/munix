import { useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useTagStore } from "@/store/tag-store";

interface MultitextWidgetProps {
  value: string[];
  onChange: (v: string[], flush: boolean) => void;
  showAutoComplete?: boolean;
}

export function MultitextWidget({
  value,
  onChange,
  showAutoComplete = false,
}: MultitextWidgetProps) {
  const [input, setInput] = useState("");
  const [acHighlight, setAcHighlight] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // TODO: autocomplete dropdown — using index.tags() prefix matching
  const tagIndex = useTagStore((s) => s.index);
  const allTags = showAutoComplete
    ? tagIndex
        .tags()
        .filter(
          ({ tag }) =>
            input.trim().length > 0 &&
            tag.toLowerCase().startsWith(input.toLowerCase()) &&
            !value.includes(tag),
        )
        .slice(0, 8)
    : [];

  const addChip = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const next = [...value, trimmed];
    onChange(next, false);
    setInput("");
    setAcHighlight(-1);
  };

  const removeChip = (idx: number) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showAutoComplete && allTags.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAcHighlight((p) => Math.min(p + 1, allTags.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setAcHighlight((p) => Math.max(p - 1, -1));
        return;
      }
      if (e.key === "Enter" && acHighlight >= 0) {
        e.preventDefault();
        const tag = allTags[acHighlight];
        if (tag) addChip(tag.tag);
        return;
      }
    }
    if (e.key === "," || e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      addChip(input);
    } else if (e.key === "Backspace" && input === "") {
      e.preventDefault();
      if (value.length > 0) {
        const next = value.slice(0, -1);
        onChange(next, true);
      }
    }
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "flex flex-wrap items-center gap-1 rounded border px-1.5 py-0.5",
          "border-[var(--color-border-secondary)] bg-[var(--color-bg-secondary)]",
          "hover:border-[var(--color-border-primary)]",
          "focus-within:border-[var(--color-accent)] focus-within:bg-[var(--color-bg-tertiary)]",
          "min-h-[26px]",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((chip, i) => (
          <span
            key={i}
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px]",
              "bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]",
            )}
          >
            {chip}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeChip(i);
              }}
              className="ml-0.5 rounded p-0.5 hover:text-[var(--color-text-primary)]"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.currentTarget.value);
            setAcHighlight(-1);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (input.trim()) addChip(input);
            // small delay to allow click on autocomplete
            setTimeout(() => setAcHighlight(-1), 150);
          }}
          className="min-w-[60px] flex-1 bg-transparent text-xs outline-none"
        />
      </div>
      {showAutoComplete && allTags.length > 0 && (
        <ul
          className={cn(
            "absolute left-0 top-full z-50 mt-0.5 w-full rounded border shadow-md",
            "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]",
            "max-h-48 overflow-y-auto text-xs",
          )}
        >
          {allTags.map(({ tag }, i) => (
            <li key={tag}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addChip(tag);
                }}
                className={cn(
                  "w-full px-2 py-1 text-left",
                  i === acHighlight
                    ? "bg-[var(--color-bg-hover)]"
                    : "hover:bg-[var(--color-bg-hover)]",
                )}
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
