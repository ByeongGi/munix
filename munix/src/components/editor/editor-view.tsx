import { useEditor, EditorContent } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createEditorExtensions } from "@/components/editor/extensions";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useEditorStore } from "@/store/editor-store";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { SearchBar } from "@/components/editor/search-bar";
import { BubbleMenuBar } from "@/components/editor/bubble-menu";
import { TableMenu } from "@/components/editor/table-menu";
import { PropertiesPanel } from "@/components/editor/properties";
import { EditorTitleInput } from "@/components/editor/editor-title-input";
import { ErrorBoundary } from "@/components/error-boundary";
import { BlockMenu } from "@/components/editor/block-menu";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { GripVertical } from "lucide-react";
import { useKeymapMatcher } from "@/hooks/use-keymap";
import { preprocessMarkdown } from "@/lib/editor-preprocess";

interface EditorViewProps {
  className?: string;
}

function normalizeSourceLine(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s?/, "")
    .replace(/^[-*+]\s+\[[ xX]\]\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

export function EditorView({ className }: EditorViewProps) {
  const { t } = useTranslation(["editor", "common"]);
  const currentPath = useEditorStore((s) => s.currentPath);
  const body = useEditorStore((s) => s.body);
  const pendingJumpHeading = useEditorStore((s) => s.pendingJumpHeading);
  const pendingJumpLine = useEditorStore((s) => s.pendingJumpLine);
  const [searchOpen, setSearchOpen] = useState(false);
  // blockPos는 DragHandle onNodeChange 콜백이 갱신. state로 두면 매 호버마다
  // EditorView rerender → DragHandle props 재생성 → 내부 useEffect 재발동으로
  // ProseMirror plugin이 재등록되어 슬래시/Wikilink suggestion view가 destroy됨.
  // ref로 바꿔서 rerender 발생 안 시킴 — UI에 직접 표시하는 값이 아님.
  const blockPosRef = useRef<number | null>(null);
  const [blockMenu, setBlockMenu] = useState<{
    pos: number;
    anchor: { x: number; y: number };
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleNodeChange = useCallback(({ pos }: { pos: number | null }) => {
    blockPosRef.current = pos;
  }, []);

  const handleGripClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const pos = blockPosRef.current;
      if (pos == null) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setBlockMenu({
        pos,
        anchor: { x: rect.right + 4, y: rect.top },
      });
    },
    [],
  );

  const handleSearchClose = useCallback(() => setSearchOpen(false), []);
  const handleBlockMenuClose = useCallback(() => setBlockMenu(null), []);

  const hasPendingSearch =
    useEditorStore.getState().pendingSearchQuery !== null;

  const editor = useEditor(
    {
      extensions: createEditorExtensions(t("editor:placeholder.document"), {
        hasFrontmatter: () => useEditorStore.getState().frontmatter !== null,
        onFrontmatterTrigger: () => {
          const store = useEditorStore.getState();
          store.setFrontmatter({});
          store.setPendingPropertyFocus(true);
          store.requestSave?.();
        },
      }),
      content: preprocessMarkdown(body),
      // 파일 열 때 문서 시작으로 커서 → 스크롤 상단 고정
      // 검색 결과 클릭일 땐 별도 useEffect에서 match 위치로 스크롤
      autofocus: hasPendingSearch ? false : "start",
      editorProps: {
        attributes: {
          class: cn(
            "tiptap prose max-w-none",
            "min-h-[60vh] px-12 pt-4 pb-10 outline-none",
            "prose-headings:font-semibold prose-headings:tracking-tight",
            "prose-p:my-2 prose-li:my-0",
            "prose-code:before:content-none prose-code:after:content-none",
            "prose-code:rounded prose-code:bg-[var(--color-bg-tertiary)] prose-code:px-1 prose-code:py-0.5",
            "prose-pre:bg-[var(--color-bg-tertiary)] prose-pre:border prose-pre:border-[var(--color-border-primary)]",
          ),
        },
      },
    },
    [t],
  );

  const jumpToSourceLine = useCallback(
    (lineNum: number): boolean => {
      if (!editor || lineNum < 1) return false;
      const lines = body.split("\n");
      const rawLine = lines[lineNum - 1];
      if (rawLine == null) return false;
      const target = normalizeSourceLine(rawLine);
      if (!target) return false;

      const priorOccurrences = lines
        .slice(0, lineNum - 1)
        .map(normalizeSourceLine)
        .filter((line) => line === target).length;

      let seen = 0;
      let targetPos: number | null = null;
      editor.state.doc.descendants((node, pos) => {
        if (!node.isBlock || !node.textContent.trim()) return;
        const text = node.textContent.trim();
        if (text === target || text.includes(target)) {
          if (seen === priorOccurrences) {
            targetPos = pos + 1;
            return false;
          }
          seen += 1;
        }
      });

      if (targetPos == null) return false;
      editor.commands.setTextSelection(targetPos);
      const dom = editor.view.nodeDOM(Math.max(0, targetPos - 1));
      if (dom instanceof Element) {
        dom.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        const { node } = editor.view.domAtPos(targetPos);
        const el = node instanceof Element ? node : node.parentElement;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return true;
    },
    [body, editor],
  );

  useEffect(() => {
    if (!editor) return;
    if (editor.isDestroyed) return;
    const storage = editor.storage as unknown as {
      markdown: { getMarkdown: () => string };
    };
    const current = storage.markdown.getMarkdown();
    if (current !== body) {
      editor.commands.setContent(preprocessMarkdown(body), {
        emitUpdate: false,
      });
    }

    // vault 검색에서 결과 클릭으로 파일이 열린 경우, 동일 쿼리로 인파일 하이라이트
    const pending = useEditorStore.getState().pendingSearchQuery;
    const pendingLine = useEditorStore.getState().pendingJumpLine;
    if (pending) {
      useEditorStore.getState().setPendingSearchQuery(null);
      requestAnimationFrame(() => {
        if (editor.isDestroyed) return;
        editor.commands.setSearchQuery(pending);
        if (pendingLine !== null && jumpToSourceLine(pendingLine)) {
          useEditorStore.getState().setPendingJumpLine(null);
        }
        setSearchOpen(true);
      });
    } else {
      // 평범하게 연 경우: 스크롤 상단으로 고정
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }
  }, [editor, body, jumpToSourceLine]);

  useAutoSave(editor);

  useEffect(() => {
    if (!editor || !pendingJumpHeading) return;
    useEditorStore.getState().setPendingJumpHeading(null);
    editor.state.doc.descendants((node, pos) => {
      if (
        node.type.name === "heading" &&
        node.textContent === pendingJumpHeading
      ) {
        editor.commands.setTextSelection(pos + 1);
        const dom = editor.view.nodeDOM(pos);
        if (dom instanceof Element) {
          dom.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return false;
      }
    });
  }, [editor, pendingJumpHeading]);

  useEffect(() => {
    if (!editor || pendingJumpLine === null) return;
    if (useEditorStore.getState().pendingSearchQuery !== null) return;
    useEditorStore.getState().setPendingJumpLine(null);
    const jumped = jumpToSourceLine(pendingJumpLine);
    if (!jumped) {
      try {
        let blockIdx = 0;
        let targetPos = 1;
        editor.state.doc.forEach((_node, pos) => {
          blockIdx += 1;
          if (blockIdx === pendingJumpLine) targetPos = pos + 1;
        });
        const safePos = Math.max(
          1,
          Math.min(targetPos, editor.state.doc.content.size - 1),
        );
        editor.commands.setTextSelection(safePos);
        const { node } = editor.view.domAtPos(safePos);
        const el = node instanceof Element ? node : node.parentElement;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        // DOM 위치 계산 실패 시 무시
      }
    }
  }, [editor, jumpToSourceLine, pendingJumpLine]);

  const matchEditor = useKeymapMatcher("editor");
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const id = matchEditor(e);
      if (id === "editor.findInFile") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [matchEditor]);

  if (!currentPath) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-tertiary)]">
        {t("editor:placeholder.selectFile")}
      </div>
    );
  }

  return (
    <div className={cn("relative h-full", className)}>
      <SearchBar
        editor={editor}
        open={searchOpen}
        onClose={handleSearchClose}
      />
      <div ref={scrollRef} className="h-full overflow-y-auto">
        <EditorTitleInput />
        <ErrorBoundary scope="properties-panel" inline>
          <PropertiesPanel />
        </ErrorBoundary>
        <BubbleMenuBar editor={editor} />
        <TableMenu editor={editor} />
        {editor && (
          <DragHandle
            editor={editor}
            onNodeChange={handleNodeChange}
            className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] active:cursor-grabbing"
          >
            <button
              type="button"
              draggable={false}
              onClick={handleGripClick}
              className="flex h-full w-full items-center justify-center"
              aria-label={t("editor:blockMenu.trigger")}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </DragHandle>
        )}
        {blockMenu && editor && (
          <BlockMenu
            editor={editor}
            pos={blockMenu.pos}
            anchor={blockMenu.anchor}
            onClose={handleBlockMenuClose}
          />
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
