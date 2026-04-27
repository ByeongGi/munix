import { useMemo, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AddProperty } from "@/components/editor/properties/add-property";
import { PropertyRow } from "@/components/editor/properties/property-row";
import { cn } from "@/lib/cn";
import { defaultValueForPropertyType } from "@/lib/property-defaults";
import { usePropertyTypesStore } from "@/store/property-types-store";
import type { PropertyType } from "@/types/frontmatter";

interface InactivePanePropertiesPanelProps {
  frontmatter: Record<string, unknown> | null;
  onChange: (
    frontmatter: Record<string, unknown> | null,
    flush: boolean,
  ) => void;
}

export function InactivePanePropertiesPanel({
  frontmatter,
  onChange,
}: InactivePanePropertiesPanelProps) {
  const { t } = useTranslation(["properties"]);
  const resolve = usePropertyTypesStore((s) => s.resolve);
  const setType = usePropertyTypesStore((s) => s.setType);
  const entries = useMemo(
    () => Object.entries(frontmatter ?? {}) as [string, unknown][],
    [frontmatter],
  );

  const fm = (frontmatter ?? {}) as Record<string, unknown>;

  const handleValueChange = (key: string, raw: unknown, flush: boolean) => {
    onChange({ ...fm, [key]: raw }, flush);
  };

  const handleDelete = (key: string) => {
    const next = { ...fm };
    delete next[key];
    onChange(Object.keys(next).length === 0 ? null : next, true);
  };

  const handleAdd = (key: string, type: PropertyType) => {
    onChange({ ...fm, [key]: defaultValueForPropertyType(type) }, true);
    void setType(key, type);
  };

  const handleDeletePanel = () => {
    onChange(null, true);
  };

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const isField =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable;
    if (isField) return;
    if (entries.length > 0) return;
    if (event.key !== "Backspace" && event.key !== "Delete") return;

    event.preventDefault();
    handleDeletePanel();
  };

  if (frontmatter === null) return null;

  return (
    <div
      className={cn(
        "mx-12 mt-3 mb-1 rounded-md border",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-primary)]",
      )}
      tabIndex={0}
      onKeyDown={handlePanelKeyDown}
    >
      <div className="flex h-7 items-center gap-2 border-b border-[var(--color-border-primary)] px-2.5">
        <span
          className={cn(
            "text-[11px] font-medium",
            "text-[var(--color-text-secondary)]",
          )}
        >
          {t("properties:heading")}
        </span>
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          {entries.length}
        </span>
        <button
          type="button"
          onClick={handleDeletePanel}
          className={cn(
            "ml-auto rounded p-0.5",
            "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-secondary)]",
          )}
          aria-label={t("properties:deletePanel")}
          title={t("properties:deletePanel")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {entries.length > 0 ? (
        <div className="px-1.5 py-1">
          {entries.map(([key, value]) => (
            <PropertyRow
              key={key}
              fieldKey={key}
              value={value}
              type={resolve(key, value)}
              onValueChange={(raw, flush) => handleValueChange(key, raw, flush)}
              onDelete={() => handleDelete(key)}
              onTypeChange={(type: PropertyType) => {
                void setType(key, type);
              }}
            />
          ))}
        </div>
      ) : null}
      <div
        className={cn(
          entries.length > 0
            ? "border-t border-[var(--color-border-primary)] px-1.5 py-1"
            : "px-1.5 py-1",
        )}
      >
        <AddProperty
          existingKeys={entries.map(([key]) => key)}
          onAdd={handleAdd}
          enablePendingFocus={false}
        />
      </div>
    </div>
  );
}
