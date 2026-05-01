import { useEffect } from "react";
import {
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  List,
  ListOrdered,
  ListTodo,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Editor } from "@tiptap/react";
import {
  moveBlockUp,
  moveBlockDown,
  duplicateBlock,
  deleteBlock,
  convertBlock,
} from "./block-actions";
import { cn } from "@/lib/cn";

interface BlockMenuProps {
  editor: Editor;
  pos: number;
  anchor: { x: number; y: number };
  onClose: () => void;
}

export function BlockMenu({ editor, pos, anchor, onClose }: BlockMenuProps) {
  const { t } = useTranslation(["editor"]);
  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // 약간의 지연 — 같은 클릭 이벤트가 다시 close 트리거하지 않게
    const t = setTimeout(() => {
      window.addEventListener("click", close);
    }, 0);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const run = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <div
      role="menu"
      onClick={(e) => e.stopPropagation()}
      style={{ top: anchor.y, left: anchor.x }}
      className={cn(
        "fixed z-50 min-w-[200px] rounded-md border p-1 shadow-xl",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary-solid)]",
      )}
    >
      <Item
        icon={ArrowUp}
        label={t("editor:blockMenu.moveUp")}
        shortcut="⌘⇧↑"
        onClick={() => run(() => moveBlockUp(editor, pos))}
      />
      <Item
        icon={ArrowDown}
        label={t("editor:blockMenu.moveDown")}
        shortcut="⌘⇧↓"
        onClick={() => run(() => moveBlockDown(editor, pos))}
      />
      <Item
        icon={Copy}
        label={t("editor:blockMenu.duplicate")}
        shortcut="⌘D"
        onClick={() => run(() => duplicateBlock(editor, pos))}
      />
      <Item
        icon={Trash2}
        label={t("editor:blockMenu.delete")}
        danger
        onClick={() => run(() => deleteBlock(editor, pos))}
      />
      <Divider />
      <SectionLabel>{t("editor:blockMenu.convert")}</SectionLabel>
      <Item
        icon={Pilcrow}
        label={t("editor:blockMenu.paragraph")}
        onClick={() => run(() => convertBlock(editor, pos, "paragraph"))}
      />
      <Item
        icon={Heading1}
        label={t("editor:blockMenu.heading1")}
        onClick={() => run(() => convertBlock(editor, pos, "heading1"))}
      />
      <Item
        icon={Heading2}
        label={t("editor:blockMenu.heading2")}
        onClick={() => run(() => convertBlock(editor, pos, "heading2"))}
      />
      <Item
        icon={Heading3}
        label={t("editor:blockMenu.heading3")}
        onClick={() => run(() => convertBlock(editor, pos, "heading3"))}
      />
      <Item
        icon={Quote}
        label={t("editor:blockMenu.blockquote")}
        onClick={() => run(() => convertBlock(editor, pos, "blockquote"))}
      />
      <Item
        icon={Code}
        label={t("editor:blockMenu.codeBlock")}
        onClick={() => run(() => convertBlock(editor, pos, "codeBlock"))}
      />
      <Item
        icon={List}
        label={t("editor:blockMenu.bulletList")}
        onClick={() => run(() => convertBlock(editor, pos, "bulletList"))}
      />
      <Item
        icon={ListOrdered}
        label={t("editor:blockMenu.orderedList")}
        onClick={() => run(() => convertBlock(editor, pos, "orderedList"))}
      />
      <Item
        icon={ListTodo}
        label={t("editor:blockMenu.taskList")}
        onClick={() => run(() => convertBlock(editor, pos, "taskList"))}
      />
    </div>
  );
}

function Item({
  icon: Icon,
  label,
  shortcut,
  danger = false,
  onClick,
}: {
  icon: typeof ArrowUp;
  label: string;
  shortcut?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs",
        "hover:bg-[var(--color-bg-hover)]",
        danger
          ? "text-[var(--color-danger)]"
          : "text-[var(--color-text-secondary)]",
      )}
    >
      <span className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      {shortcut && (
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          {shortcut}
        </span>
      )}
    </button>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-[var(--color-border-secondary)]" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
      {children}
    </div>
  );
}
