import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ContextMenuPortal } from "@/components/ui/context-menu-portal";
import { cn } from "@/lib/cn";
import {
  requestCloseContextMenus,
  subscribeContextMenuClose,
} from "@/lib/context-menu-coordinator";
import { getContextMenuSurfaceStyle } from "@/lib/context-menu-position";
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
    const unsubscribeContextMenuClose = subscribeContextMenuClose(() =>
      setPos(null),
    );
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      unsubscribeContextMenuClose();
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [pos]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    requestCloseContextMenus();
    setPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div onContextMenu={handleContextMenu} className="contents">
        {children}
      </div>
      {pos && (
        <ContextMenuPortal>
          <div
            ref={menuRef}
            style={getContextMenuSurfaceStyle({
              x: pos.x,
              y: pos.y,
              minWidth: 180,
              estimatedHeight: 260,
            })}
            className={cn(
              "munix-context-menu fixed z-50 min-w-[180px] rounded-md border py-1 shadow-lg",
              "border-[var(--color-border-primary)] bg-[var(--color-context-menu-bg)]",
            )}
          >
            <div className="munix-context-menu-section px-2 py-1 font-semibold uppercase text-[var(--color-context-menu-muted)]">
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
                  "munix-context-menu-item flex w-full items-center gap-2 px-2 py-1",
                  "hover:bg-[var(--color-bg-hover)]",
                  "text-[var(--color-context-menu-text)]",
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
                "munix-context-menu-item flex w-full items-center px-2 py-1",
                "hover:bg-[var(--color-bg-hover)]",
                "text-[var(--color-context-menu-danger)]",
              )}
            >
              {t("properties:menu.delete")}
            </button>
          </div>
        </ContextMenuPortal>
      )}
    </>
  );
}
