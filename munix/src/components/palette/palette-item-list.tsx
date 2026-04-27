import type { TFunction } from "i18next";
import {
  ArrowRight,
  FileText,
  Hash,
  Heading,
  Heading1,
  Heading2,
  Heading3,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/cn";
import type { PaletteItem } from "./palette-items";

interface PaletteItemListProps {
  items: PaletteItem[];
  selectedIndex: number;
  t: TFunction<["palette", "common"]>;
  onRun: (item: PaletteItem) => void;
  onSelect: (index: number) => void;
}

function headingIcon(level: number): LucideIcon {
  if (level === 1) return Heading1;
  if (level === 2) return Heading2;
  if (level === 3) return Heading3;
  return Heading;
}

function itemButtonClass(isSelected: boolean): string {
  return cn(
    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
    isSelected
      ? "bg-[var(--color-bg-hover)]"
      : "hover:bg-[var(--color-bg-hover)]",
  );
}

export function PaletteItemList({
  items,
  selectedIndex,
  t,
  onRun,
  onSelect,
}: PaletteItemListProps) {
  return items.map((item, index) => {
    const buttonClass = itemButtonClass(index === selectedIndex);
    const commonProps = {
      className: buttonClass,
      onClick: () => onRun(item),
      onMouseEnter: () => onSelect(index),
      type: "button" as const,
    };

    if (item.kind === "file") {
      return (
        <li key={`file-${item.hit.path}`}>
          <button {...commonProps}>
            <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
            <div className="flex flex-1 flex-col overflow-hidden">
              <span className="truncate">{item.hit.title}</span>
              <span className="truncate text-[11px] text-[var(--color-text-tertiary)]">
                {item.hit.path}
              </span>
            </div>
          </button>
        </li>
      );
    }

    if (item.kind === "command") {
      const Icon = item.cmd.icon;
      return (
        <li key={item.cmd.id}>
          <button {...commonProps}>
            <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
            <span className="flex-1 truncate">{item.cmd.title}</span>
            {item.cmd.shortcut ? (
              <span className="text-[11px] text-[var(--color-text-tertiary)]">
                {item.cmd.shortcut}
              </span>
            ) : null}
          </button>
        </li>
      );
    }

    if (item.kind === "tag") {
      return (
        <li key={`tag-${item.tag}`}>
          <button {...commonProps}>
            <Hash className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
            <span className="flex-1 truncate">
              <span className="text-[var(--color-accent)]">#</span>
              {item.tag}
            </span>
            <span className="text-[11px] text-[var(--color-text-tertiary)]">
              {item.fileCount}
            </span>
          </button>
        </li>
      );
    }

    if (item.kind === "heading") {
      const Icon = headingIcon(item.level);
      return (
        <li key={`heading-${item.index}`}>
          <button {...commonProps}>
            <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
            <span className="flex-1 truncate">{item.text}</span>
            <span className="text-[11px] text-[var(--color-text-tertiary)]">
              H{item.level}
            </span>
          </button>
        </li>
      );
    }

    if (item.kind === "line") {
      return (
        <li key={`line-${item.lineNum}`}>
          <button {...commonProps}>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
            <span className="flex-1 truncate">
              {t("palette:action.jumpToLine", { line: item.lineNum })}
            </span>
          </button>
        </li>
      );
    }

    return null;
  });
}
