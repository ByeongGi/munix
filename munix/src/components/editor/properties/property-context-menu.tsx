import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { KNOWN_PROPERTY_TYPES, type PropertyType } from "@/types/frontmatter";

const TAGS_KEYS = new Set(["tags", "tag", "aliases", "alias"]);

interface PropertyContextMenuProps {
  fieldKey: string;
  currentType: PropertyType;
  onTypeChange: (type: PropertyType) => void;
  onDelete: () => void;
  children: React.ReactNode;
}

interface MenuPos {
  x: number;
  y: number;
}

export function PropertyContextMenu({
  fieldKey,
  currentType,
  onTypeChange,
  onDelete,
  children,
}: PropertyContextMenuProps) {
  const { t } = useTranslation(["properties"]);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const allowedTypes: PropertyType[] = KNOWN_PROPERTY_TYPES.filter(
    (type) => !["tags", "aliases"].includes(type) || TAGS_KEYS.has(fieldKey),
  );

  useEffect(() => {
    if (!pos) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setPos(null);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPos(null);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [pos]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div onContextMenu={handleContextMenu} className="contents">
        {children}
      </div>
      {pos && (
        <div
          ref={menuRef}
          style={{ left: pos.x, top: pos.y }}
          className={cn(
            "fixed z-50 min-w-[180px] rounded-md border py-1 shadow-lg",
            "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary-solid)]",
            "text-xs",
          )}
        >
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
            {t("properties:menu.type")}
          </div>
          {allowedTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onTypeChange(type);
                setPos(null);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-2 py-1",
                "hover:bg-[var(--color-bg-hover)]",
                "text-[var(--color-text-primary)]",
              )}
            >
              <span className="w-3">
                {currentType === type && <Check className="h-3 w-3" />}
              </span>
              {t(`properties:types.${type}`, { defaultValue: type })}
            </button>
          ))}
          <div className="my-1 border-t border-[var(--color-border-primary)]" />
          <button
            type="button"
            onClick={() => {
              onDelete();
              setPos(null);
            }}
            className={cn(
              "flex w-full items-center px-2 py-1",
              "hover:bg-[var(--color-bg-hover)]",
              "text-[var(--color-text-primary)]",
            )}
          >
            {t("properties:menu.delete")}
          </button>
        </div>
      )}
    </>
  );
}
