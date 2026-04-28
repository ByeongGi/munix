import { BubbleMenu as TiptapBubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  Bold,
  Check,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Unlink,
  X,
  Highlighter,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

interface BubbleMenuBarProps {
  editor: Editor | null;
}

function normalizeLinkHref(value: string): string {
  const href = value.trim();
  if (!href) return "";
  if (/^(https?:|mailto:|tel:|#|\/|\.\.?\/)/i.test(href)) return href;
  return `https://${href}`;
}

export function BubbleMenuBar({ editor }: BubbleMenuBarProps) {
  const { t } = useTranslation(["editor"]);
  const selectionRangeRef = useRef<{ from: number; to: number } | null>(null);
  const linkInputRef = useRef<HTMLInputElement | null>(null);
  const linkEditingRangeRef = useRef<{ from: number; to: number } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkTextDraft, setLinkTextDraft] = useState("");
  const [linkDraft, setLinkDraft] = useState("");

  const runWithSelection = useCallback(
    (command: (range: { from: number; to: number }) => void) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      const range =
        from !== to ? { from, to } : selectionRangeRef.current;
      if (!editor || !range || range.from === range.to) return;
      command(range);
    },
    [editor],
  );

  useEffect(() => {
    if (!linkOpen) return;
    const id = requestAnimationFrame(() => {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [linkOpen]);

  if (!editor) return null;

  const handleLinkOpen = () => {
    const { from, to } = editor.state.selection;
    if (from !== to) selectionRangeRef.current = { from, to };
    const range = from !== to ? { from, to } : selectionRangeRef.current;
    linkEditingRangeRef.current = range;
    const prev = editor.getAttributes("link").href as string | undefined;
    const selectedText = range
      ? editor.state.doc.textBetween(range.from, range.to, "\n")
      : "";
    setLinkTextDraft(selectedText);
    setLinkDraft(prev ?? "");
    setLinkOpen(true);
  };

  const handleLinkApply = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const href = normalizeLinkHref(linkDraft);
    runWithSelection((range) => {
      const text = linkTextDraft.trim() || href;
      if (text) {
        editor
          .chain()
          .focus()
          .insertContentAt(range, {
            type: "text",
            text,
            marks: href ? [{ type: "link", attrs: { href } }] : undefined,
          })
          .run();
        return;
      }
      const chain = editor.chain().focus().setTextSelection(range);
      if (!href) {
        chain.extendMarkRange("link").unsetLink().run();
        return;
      }
      chain.extendMarkRange("link").setLink({ href }).run();
    });
    linkEditingRangeRef.current = null;
    setLinkOpen(false);
  };

  const handleLinkRemove = () => {
    runWithSelection((range) => {
      editor
        .chain()
        .focus()
        .setTextSelection(range)
        .extendMarkRange("link")
        .unsetLink()
        .run();
    });
    linkEditingRangeRef.current = null;
    setLinkOpen(false);
  };

  const handleLinkInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      linkEditingRangeRef.current = null;
      setLinkOpen(false);
      editor.commands.focus();
    }
  };

  return (
    <TiptapBubbleMenu
      editor={editor}
      options={{ placement: "top" }}
      shouldShow={({ editor: e, state }) => {
        const { selection } = state;
        if (
          selection instanceof NodeSelection &&
          selection.node.type.name === "horizontalRule"
        ) {
          return false;
        }

        const { from, to } = state.selection;
        if (from === to) return false;
        // 코드 블럭 내부에서는 숨김
        if (e.isActive("codeBlock")) return false;
        const editingRange = linkEditingRangeRef.current;
        if (
          linkOpen &&
          (!editingRange || editingRange.from !== from || editingRange.to !== to)
        ) {
          linkEditingRangeRef.current = null;
          setLinkOpen(false);
        }
        selectionRangeRef.current = { from, to };
        return true;
      }}
      className={cn(
        "flex items-center gap-0.5 rounded-md border p-1 shadow-lg",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]",
      )}
    >
      {linkOpen ? (
        <form
          className="flex w-[28rem] max-w-[calc(100vw-3rem)] flex-col gap-1 p-1"
          onSubmit={handleLinkApply}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div
            className={cn(
              "flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded border px-2",
              "border-[var(--color-border-primary)] bg-[var(--color-bg-primary)]",
              "focus-within:border-[var(--color-border-focus)]",
            )}
          >
            <span className="shrink-0 text-xs text-[var(--color-text-tertiary)]">
              T
            </span>
            <input
              value={linkTextDraft}
              onChange={(event) => setLinkTextDraft(event.target.value)}
              onKeyDown={handleLinkInputKeyDown}
              placeholder={t("editor:bubbleMenu.linkTextPlaceholder")}
              aria-label={t("editor:bubbleMenu.linkTextPlaceholder")}
              className={cn(
                "h-full min-w-0 flex-1 bg-transparent text-xs outline-none",
                "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]",
              )}
            />
            {linkTextDraft ? (
              <button
                type="button"
                onClick={() => setLinkTextDraft("")}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                title={t("editor:bubbleMenu.linkClear")}
                aria-label={t("editor:bubbleMenu.linkClear")}
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
          <div
            className={cn(
              "flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded border px-2",
              "border-[var(--color-border-primary)] bg-[var(--color-bg-primary)]",
              "focus-within:border-[var(--color-border-focus)]",
            )}
          >
            <LinkIcon className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
            <input
              ref={linkInputRef}
              value={linkDraft}
              onChange={(event) => setLinkDraft(event.target.value)}
              onKeyDown={handleLinkInputKeyDown}
              placeholder={t("editor:bubbleMenu.linkUrlPlaceholder")}
              aria-label={t("editor:bubbleMenu.linkUrlPlaceholder")}
              className={cn(
                "h-full min-w-0 flex-1 bg-transparent text-xs outline-none",
                "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]",
              )}
            />
            {linkDraft ? (
              <button
                type="button"
                onClick={() => {
                  setLinkDraft("");
                  linkInputRef.current?.focus();
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                title={t("editor:bubbleMenu.linkClear")}
                aria-label={t("editor:bubbleMenu.linkClear")}
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-0.5">
            <button
              type="button"
              onClick={handleLinkRemove}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-danger)]"
              title={t("editor:bubbleMenu.linkRemove")}
              aria-label={t("editor:bubbleMenu.linkRemove")}
            >
              <Unlink className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                linkEditingRangeRef.current = null;
                setLinkOpen(false);
                editor.commands.focus();
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              title={t("editor:bubbleMenu.linkClose")}
              aria-label={t("editor:bubbleMenu.linkClose")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="submit"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--color-accent-muted)] text-[var(--color-accent)] hover:bg-[var(--color-accent-muted-hover)]"
              title={t("editor:bubbleMenu.linkApply")}
              aria-label={t("editor:bubbleMenu.linkApply")}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      ) : (
        <>
      <MenuBtn
        icon={Bold}
        label={t("editor:bubbleMenu.bold")}
        active={editor.isActive("bold")}
        onClick={() =>
          runWithSelection((range) =>
            editor.chain().focus().setTextSelection(range).toggleBold().run(),
          )
        }
      />
      <MenuBtn
        icon={Italic}
        label={t("editor:bubbleMenu.italic")}
        active={editor.isActive("italic")}
        onClick={() =>
          runWithSelection((range) =>
            editor.chain().focus().setTextSelection(range).toggleItalic().run(),
          )
        }
      />
      <MenuBtn
        icon={Underline}
        label={t("editor:bubbleMenu.underline")}
        active={editor.isActive("underline")}
        onClick={() =>
          runWithSelection((range) =>
            editor
              .chain()
              .focus()
              .setTextSelection(range)
              .toggleUnderline()
              .run(),
          )
        }
      />
      <MenuBtn
        icon={Strikethrough}
        label={t("editor:bubbleMenu.strike")}
        active={editor.isActive("strike")}
        onClick={() =>
          runWithSelection((range) =>
            editor.chain().focus().setTextSelection(range).toggleStrike().run(),
          )
        }
      />
      <MenuBtn
        icon={Code}
        label={t("editor:bubbleMenu.code")}
        active={editor.isActive("code")}
        onClick={() =>
          runWithSelection((range) =>
            editor.chain().focus().setTextSelection(range).toggleCode().run(),
          )
        }
      />
      <MenuBtn
        icon={Highlighter}
        label={t("editor:bubbleMenu.highlight")}
        active={editor.isActive("highlight")}
        onClick={() =>
          runWithSelection((range) =>
            editor
              .chain()
              .focus()
              .setTextSelection(range)
              .toggleHighlight()
              .run(),
          )
        }
      />
      <div className="mx-1 h-4 w-px bg-[var(--color-border-primary)]" />
      <MenuBtn
        icon={LinkIcon}
        label={t("editor:bubbleMenu.link")}
        active={editor.isActive("link")}
        onClick={handleLinkOpen}
      />
        </>
      )}
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
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.button === 0) onClick();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
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
