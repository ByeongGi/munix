import {
  Calendar,
  CheckSquare,
  Clock,
  Hash,
  Link2,
  List,
  Tag,
  Type,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { PropertyType } from "@/types/frontmatter";
import {
  CheckboxWidget,
  DatetimeWidget,
  DateWidget,
  MultitextWidget,
  NumberWidget,
  TextWidget,
} from "./widgets";
import { PropertyContextMenu } from "./property-context-menu";

interface PropertyRowProps {
  fieldKey: string;
  value: unknown;
  type: PropertyType;
  onValueChange: (raw: unknown, flush: boolean) => void;
  onDelete: () => void;
  onTypeChange: (type: PropertyType) => void;
}

function TypeIcon({ type }: { type: PropertyType }) {
  const cls = "h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]";
  switch (type) {
    case "text":
      return <Type className={cls} />;
    case "multitext":
      return <List className={cls} />;
    case "number":
      return <Hash className={cls} />;
    case "checkbox":
      return <CheckSquare className={cls} />;
    case "date":
      return <Calendar className={cls} />;
    case "datetime":
      return <Clock className={cls} />;
    case "tags":
      return <Tag className={cls} />;
    case "aliases":
      return <Link2 className={cls} />;
  }
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === "string");
}

function isComplexValue(v: unknown): boolean {
  if (Array.isArray(v) && !isStringArray(v)) return true;
  if (typeof v === "object" && v !== null && !Array.isArray(v)) return true;
  return false;
}

function coerceToStringArray(v: unknown): string[] {
  if (isStringArray(v)) return v;
  if (typeof v === "string") {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function PropertyRow({
  fieldKey,
  value,
  type,
  onValueChange,
  onDelete,
  onTypeChange,
}: PropertyRowProps) {
  const complex = isComplexValue(value);

  const renderWidget = () => {
    if (complex) {
      return (
        <TextWidget
          value={JSON.stringify(value)}
          onChange={() => {
            // read-only for complex YAML
          }}
        />
      );
    }

    switch (type) {
      case "text":
        return (
          <TextWidget
            value={typeof value === "string" ? value : String(value ?? "")}
            onChange={(v, flush) => onValueChange(v, flush)}
          />
        );
      case "number":
        return (
          <NumberWidget
            value={typeof value === "number" ? value : null}
            onChange={(v, flush) => onValueChange(v, flush)}
          />
        );
      case "checkbox":
        return (
          <CheckboxWidget
            value={value === true}
            onChange={(v) => onValueChange(v, true)}
          />
        );
      case "date":
        return (
          <DateWidget
            value={
              typeof value === "string" || value instanceof Date ? value : null
            }
            onChange={(v, flush) => onValueChange(v, flush)}
          />
        );
      case "datetime":
        return (
          <DatetimeWidget
            value={
              typeof value === "string" || value instanceof Date ? value : null
            }
            onChange={(v, flush) => onValueChange(v, flush)}
          />
        );
      case "multitext":
      case "aliases":
        return (
          <MultitextWidget
            value={coerceToStringArray(value)}
            onChange={(v, flush) => onValueChange(v, flush)}
          />
        );
      case "tags":
        return (
          <MultitextWidget
            value={coerceToStringArray(value)}
            onChange={(v, flush) => onValueChange(v, flush)}
            showAutoComplete
          />
        );
    }
  };

  return (
    <PropertyContextMenu
      fieldKey={fieldKey}
      currentType={type}
      onTypeChange={onTypeChange}
      onDelete={onDelete}
    >
      <div
        className={cn(
          "group grid min-h-7 grid-cols-[minmax(112px,160px)_minmax(0,1fr)_20px] items-center gap-2 rounded px-1.5 py-0.5",
          "hover:bg-[var(--color-bg-hover)]",
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <TypeIcon type={type} />
          <span className="truncate text-xs text-[var(--color-text-secondary)]">
            {fieldKey}
          </span>
        </span>
        <div
          className={cn("min-w-0", complex && "opacity-50")}
          title={complex ? "Complex YAML values are read-only." : undefined}
        >
          {renderWidget()}
        </div>
        <button
          type="button"
          onClick={onDelete}
          className={cn(
            "rounded p-0.5",
            "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)]",
            "invisible group-hover:visible",
          )}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </PropertyContextMenu>
  );
}
