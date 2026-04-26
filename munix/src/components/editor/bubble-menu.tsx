import { BubbleMenu as TiptapBubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Highlighter,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

interface BubbleMenuBarProps {
  editor: Editor | null;
}

export function BubbleMenuBar({ editor }: BubbleMenuBarProps) {
  const { t } = useTranslation(["editor"]);
  if (!editor) return null;

  const handleLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <TiptapBubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      shouldShow={({ editor: e, state }) => {
        const { from, to } = state.selection;
        if (from === to) return false;
        // 코드 블럭 내부에서는 숨김
        if (e.isActive("codeBlock")) return false;
        return true;
      }}
      className={cn(
        "flex items-center gap-0.5 rounded-md border p-1 shadow-lg",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]",
      )}
    >
      <MenuBtn
        icon={Bold}
        label={t("editor:bubbleMenu.bold")}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <MenuBtn
        icon={Italic}
        label={t("editor:bubbleMenu.italic")}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <MenuBtn
        icon={Strikethrough}
        label={t("editor:bubbleMenu.strike")}
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <MenuBtn
        icon={Code}
        label={t("editor:bubbleMenu.code")}
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <MenuBtn
        icon={Highlighter}
        label={t("editor:bubbleMenu.highlight")}
        active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      />
      <div className="mx-1 h-4 w-px bg-[var(--color-border-primary)]" />
      <MenuBtn
        icon={LinkIcon}
        label={t("editor:bubbleMenu.link")}
        active={editor.isActive("link")}
        onClick={handleLink}
      />
    </TiptapBubbleMenu>
  );
}

function MenuBtn({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Bold;
  label: string;
  active: boolean;
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
        active
          ? "bg-[var(--color-bg-hover)] text-[var(--color-accent)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
