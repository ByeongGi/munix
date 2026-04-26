import {
  Copy,
  ExternalLink,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { Action, ContextMenuState } from "./types";

export function ContextMenu({
  menu,
  onAction,
}: {
  menu: ContextMenuState;
  onAction: (action: Action) => void;
}) {
  const { t } = useTranslation("tree");
  const isDir = menu.node.kind === "directory";
  const isMulti = (menu.selectedCount ?? 0) > 1;
  return (
    <div
      role="menu"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "fixed z-50 min-w-[180px] rounded-md border p-1 shadow-lg",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]",
      )}
      style={{ top: menu.y, left: menu.x }}
    >
      {isMulti && (
        <>
          <div className="px-2 py-1.5 text-xs font-medium text-[var(--color-text-primary)]">
            {t("contextMenu.selectedCount", { count: menu.selectedCount })}
          </div>
          <div className="my-1 h-px bg-[var(--color-border-secondary)]" />
        </>
      )}
      {isDir && !isMulti && (
        <>
          <MenuItem
            icon={FilePlus}
            label={t("contextMenu.newFile")}
            onClick={() => onAction("new-file")}
          />
          <MenuItem
            icon={FolderPlus}
            label={t("contextMenu.newFolder")}
            onClick={() => onAction("new-folder")}
          />
          <div className="my-1 h-px bg-[var(--color-border-secondary)]" />
        </>
      )}
      {!isMulti && (
        <MenuItem
          icon={Pencil}
          label={t("contextMenu.rename")}
          onClick={() => onAction("rename")}
        />
      )}
      <MenuItem
        icon={Copy}
        label={t("contextMenu.copyPath")}
        onClick={() => onAction("copy-path")}
      />
      {!isMulti && (
        <MenuItem
          icon={ExternalLink}
          label={t("contextMenu.revealInFinder")}
          onClick={() => onAction("reveal")}
        />
      )}
      <div className="my-1 h-px bg-[var(--color-border-secondary)]" />
      <MenuItem
        icon={Trash2}
        label={t("contextMenu.delete")}
        danger
        onClick={() => onAction("delete")}
      />
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  danger = false,
  onClick,
}: {
  icon: typeof FilePlus;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
        "hover:bg-[var(--color-bg-hover)]",
        danger
          ? "text-[var(--color-danger)]"
          : "text-[var(--color-text-secondary)]",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
