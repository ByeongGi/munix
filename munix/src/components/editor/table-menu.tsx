import { BubbleMenu as TiptapBubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import {
  ArrowUpFromLine,
  ArrowDownFromLine,
  ArrowLeftFromLine,
  ArrowRightFromLine,
  RowsIcon,
  ColumnsIcon,
  Trash2,
  Heading,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

interface TableMenuProps {
  editor: Editor | null;
}

export function TableMenu({ editor }: TableMenuProps) {
  const { t } = useTranslation(["editor"]);
  if (!editor) return null;

  return (
    <TiptapBubbleMenu
      editor={editor}
      options={{ placement: "top-start", offset: 6 }}
      shouldShow={({ editor: e, state }) => {
        // 표 안에 커서가 있고 selection은 empty (drag 선택 시엔 일반 BubbleMenu가 뜸)
        if (!e.isActive("table")) return false;
        const { from, to } = state.selection;
        return from === to;
      }}
      className={cn(
        "flex items-center gap-0.5 rounded-md border p-1 shadow-lg",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]",
      )}
    >
      <Btn
        icon={ArrowUpFromLine}
        label={t("editor:tableMenu.addRowBefore")}
        onClick={() => editor.chain().focus().addRowBefore().run()}
      />
      <Btn
        icon={ArrowDownFromLine}
        label={t("editor:tableMenu.addRowAfter")}
        onClick={() => editor.chain().focus().addRowAfter().run()}
      />
      <Btn
        icon={RowsIcon}
        label={t("editor:tableMenu.deleteRow")}
        onClick={() => editor.chain().focus().deleteRow().run()}
      />
      <div className="mx-1 h-4 w-px bg-[var(--color-border-primary)]" />
      <Btn
        icon={ArrowLeftFromLine}
        label={t("editor:tableMenu.addColumnBefore")}
        onClick={() => editor.chain().focus().addColumnBefore().run()}
      />
      <Btn
        icon={ArrowRightFromLine}
        label={t("editor:tableMenu.addColumnAfter")}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      />
      <Btn
        icon={ColumnsIcon}
        label={t("editor:tableMenu.deleteColumn")}
        onClick={() => editor.chain().focus().deleteColumn().run()}
      />
      <div className="mx-1 h-4 w-px bg-[var(--color-border-primary)]" />
      <Btn
        icon={Heading}
        label={t("editor:tableMenu.toggleHeaderRow")}
        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
      />
      <div className="mx-1 h-4 w-px bg-[var(--color-border-primary)]" />
      <Btn
        icon={Trash2}
        label={t("editor:tableMenu.deleteTable")}
        danger
        onClick={() => editor.chain().focus().deleteTable().run()}
      />
    </TiptapBubbleMenu>
  );
}

function Btn({
  icon: Icon,
  label,
  danger = false,
  onClick,
}: {
  icon: typeof ArrowUpFromLine;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded",
        danger
          ? "text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
