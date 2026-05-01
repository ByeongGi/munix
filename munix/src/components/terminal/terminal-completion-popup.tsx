import {
  Box,
  Clock3,
  FileText,
  MinusSquare,
  TerminalSquare,
} from "lucide-react";

import { cn } from "@/lib/cn";
import type {
  TerminalCompletionSuggestion,
  TerminalSuggestionKind,
} from "@/types/terminal-completion";

interface TerminalCompletionPopupProps {
  suggestions: TerminalCompletionSuggestion[];
  selectedIndex: number;
  anchor: { left: number; top: number; placement: "above" | "below" } | null;
  onPointerDownInside?: () => void;
}

const ICONS: Record<TerminalSuggestionKind, typeof TerminalSquare> = {
  command: TerminalSquare,
  subcommand: TerminalSquare,
  option: MinusSquare,
  path: FileText,
  history: Clock3,
  script: TerminalSquare,
};

const KIND_LABELS: Record<TerminalSuggestionKind, string> = {
  command: "command",
  subcommand: "command",
  option: "option",
  path: "path",
  history: "history",
  script: "script",
};

export function TerminalCompletionPopup({
  suggestions,
  selectedIndex,
  anchor,
  onPointerDownInside,
}: TerminalCompletionPopupProps) {
  if (suggestions.length === 0) return null;

  return (
    <div
      data-terminal-completion-popup="true"
      onPointerDown={onPointerDownInside}
      style={
        anchor
          ? {
              left: anchor.left,
              top: anchor.top,
              transform:
                anchor.placement === "above"
                  ? "translateY(calc(-100% - 8px))"
                  : "translateY(18px)",
            }
          : undefined
      }
      className={cn(
        "pointer-events-none absolute z-40 w-[min(520px,calc(100%-2rem))]",
        !anchor && "bottom-4 left-4",
        "overflow-hidden rounded-md border shadow-2xl",
        "border-[var(--color-terminal-border)] bg-[rgb(14_18_20_/_0.96)]",
        "font-mono text-xs text-[var(--color-terminal-text)]",
      )}
    >
      <div className="max-h-64 overflow-hidden py-1">
        {suggestions.map((suggestion, index) => {
          const Icon = ICONS[suggestion.kind] ?? Box;
          const active = index === selectedIndex;
          return (
            <div
              key={`${suggestion.kind}:${suggestion.name}:${index}`}
              className={cn(
                "grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-1.5",
                active
                  ? "bg-[rgb(20_184_166_/_0.18)] text-white"
                  : "text-[var(--color-terminal-text)]",
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5",
                  active
                    ? "text-[#5eead4]"
                    : "text-[var(--color-terminal-muted)]",
                )}
              />
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="min-w-0 truncate">{suggestion.name}</span>
                {suggestion.description ? (
                  <span className="min-w-0 truncate text-[10px] text-[var(--color-terminal-muted)]">
                    {suggestion.description}
                  </span>
                ) : null}
              </span>
              <span className="justify-self-end text-[9px] uppercase text-[var(--color-terminal-muted)]">
                {KIND_LABELS[suggestion.kind]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
