import { EditorContent } from "@tiptap/react";
import {
  Editor as TiptapEditor,
  type EditorOptions,
  type JSONContent,
} from "@tiptap/core";
import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createEditorExtensions } from "@/components/editor/extensions";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useEditorStore } from "@/store/editor-store";
import { useActiveWorkspaceStore } from "@/lib/active-vault";
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
import { GripVertical, LoaderCircle } from "lucide-react";
import { useKeymapMatcher } from "@/hooks/use-keymap";
import { preprocessMarkdownCached } from "@/lib/editor-preprocess";
import {
  focusEditorEndOnEmptySurface,
  focusEditorStartOnNextFrame,
} from "@/components/editor/editor-focus";
import type {
  DocumentRuntime,
  ScrollRuntimeState,
} from "@/store/slices/document-runtime-slice";

const DEFER_DOCUMENT_HYDRATION_MIN_LENGTH = 80_000;
const SCROLL_RESTORE_MAX_ATTEMPTS = 3;
const SCROLL_RESTORE_OBSERVER_MS = 1200;
const LIVE_EDITOR_CACHE_LIMIT = 2;
const DOCUMENT_LOADING_DELAY_MS = 350;

interface EditorViewProps {
  className?: string;
}

function useDelayedVisible(active: boolean, delayMs: number): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  return visible;
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

function captureScrollAnchor(
  editor: TiptapEditor,
  scrollEl: HTMLDivElement | null,
): ScrollRuntimeState | undefined {
  if (!scrollEl || editor.isDestroyed) return undefined;
  const containerTop = scrollEl.getBoundingClientRect().top;
  let anchorPos: number | undefined;
  let anchorOffsetTop: number | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  editor.state.doc.descendants((node, pos) => {
    if (!node.isBlock) return;
    const dom = editor.view.nodeDOM(pos);
    if (!(dom instanceof Element)) return;
    const rect = dom.getBoundingClientRect();
    const offsetTop = rect.top - containerTop;
    const distance = Math.abs(offsetTop);
    if (distance < bestDistance) {
      anchorPos = pos;
      anchorOffsetTop = offsetTop;
      bestDistance = distance;
    }
  });

  return {
    top: scrollEl.scrollTop,
    anchorPos,
    anchorOffsetTop,
  };
}

function clampSelection(
  selection: DocumentRuntime["selection"] | undefined,
  docSize: number,
) {
  if (!selection) return null;
  const max = Math.max(1, docSize - 1);
  const from = Math.max(1, Math.min(selection.from, max));
  const to = Math.max(from, Math.min(selection.to, max));
  return { from, to };
}

function restoreScrollAnchor(
  editor: TiptapEditor,
  scrollEl: HTMLDivElement | null,
  scroll: ScrollRuntimeState | undefined,
): boolean {
  if (!scrollEl || !scroll || editor.isDestroyed) return false;
  if (scroll.anchorPos == null || scroll.anchorOffsetTop == null) {
    scrollEl.scrollTop = scroll.top;
    return true;
  }

  const dom = editor.view.nodeDOM(scroll.anchorPos);
  if (!(dom instanceof Element)) {
    scrollEl.scrollTop = scroll.top;
    return true;
  }

  const containerTop = scrollEl.getBoundingClientRect().top;
  const currentOffsetTop = dom.getBoundingClientRect().top - containerTop;
  scrollEl.scrollTop += currentOffsetTop - scroll.anchorOffsetTop;
  return true;
}

function getRuntimeEditorJson(
  runtime: DocumentRuntime | null,
  path: string | null,
  body: string,
): JSONContent | null {
  if (!runtime || !path) return null;
  if (runtime.path !== path || runtime.externalModified) return null;
  if (runtime.body !== body) return null;
  return runtime.editorJson ?? null;
}

function scheduleScrollAnchorRestore(
  editor: TiptapEditor,
  scrollEl: HTMLDivElement | null,
  scroll: ScrollRuntimeState | undefined,
): () => void {
  if (!scrollEl || !scroll || editor.isDestroyed) return () => {};

  let cancelled = false;
  let attempts = 0;
  let frameId = 0;
  let timerId = 0;
  let observer: ResizeObserver | null = null;

  const run = () => {
    if (cancelled || editor.isDestroyed) return;
    attempts += 1;
    restoreScrollAnchor(editor, scrollEl, scroll);
  };

  const requestRun = () => {
    if (cancelled || attempts >= SCROLL_RESTORE_MAX_ATTEMPTS) return;
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = window.requestAnimationFrame(run);
  };

  requestRun();

  if ("ResizeObserver" in window) {
    observer = new ResizeObserver(requestRun);
    observer.observe(editor.view.dom);
  }

  timerId = window.setTimeout(() => {
    observer?.disconnect();
    observer = null;
  }, SCROLL_RESTORE_OBSERVER_MS);

  return () => {
    cancelled = true;
    if (frameId) window.cancelAnimationFrame(frameId);
    if (timerId) window.clearTimeout(timerId);
    observer?.disconnect();
  };
}

interface CachedEditorEntry {
  editor: TiptapEditor;
  lastAccessedAt: number;
  path: string;
}

function destroyEditor(editor: TiptapEditor): void {
  if (!editor.isDestroyed) editor.destroy();
}

function pruneLiveEditorCache(
  cache: Map<string, CachedEditorEntry>,
  activeTabId: string,
): void {
  const evictable = Array.from(cache.entries())
    .filter(([tabId]) => tabId !== activeTabId)
    .sort(([, a], [, b]) => a.lastAccessedAt - b.lastAccessedAt);

  while (cache.size > LIVE_EDITOR_CACHE_LIMIT) {
    const next = evictable.shift();
    if (!next) break;
    const [tabId, entry] = next;
    cache.delete(tabId);
    destroyEditor(entry.editor);
  }
}

function useLiveEditor(
  tabId: string | null,
  path: string | null,
  options: Partial<EditorOptions>,
): TiptapEditor | null {
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const cacheRef = useRef(new Map<string, CachedEditorEntry>());
  const previousOptionsRef = useRef(options);

  useLayoutEffect(() => {
    if (previousOptionsRef.current === options) return;
    for (const entry of cacheRef.current.values()) {
      destroyEditor(entry.editor);
    }
    cacheRef.current.clear();
    previousOptionsRef.current = options;
    setEditor(null);
  }, [options]);

  useLayoutEffect(() => {
    if (!tabId || !path) {
      setEditor(null);
      return;
    }

    const cache = cacheRef.current;
    const cached = cache.get(tabId);
    const entry =
      cached && !cached.editor.isDestroyed
        ? cached
        : {
            editor: new TiptapEditor(options),
            lastAccessedAt: Date.now(),
            path,
          };

    entry.lastAccessedAt = Date.now();
    entry.path = path;
    cache.set(tabId, entry);
    setEditor(entry.editor);
    pruneLiveEditorCache(cache, tabId);
  }, [options, path, tabId]);

  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      for (const entry of cache.values()) {
        destroyEditor(entry.editor);
      }
      cache.clear();
    };
  }, []);

  return editor;
}

export function EditorView({ className }: EditorViewProps) {
  const { t } = useTranslation(["editor", "common"]);
  const ws = useActiveWorkspaceStore();
  const currentTabId = useEditorStore((s) => s.currentTabId);
  const currentPath = useEditorStore((s) => s.currentPath);
  const body = useEditorStore((s) => s.body);
  const sourceVersion = useEditorStore((s) => s.sourceVersion);
  const isOpening = useEditorStore((s) => s.isOpening);
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
  const restoreCleanupRef = useRef<(() => void) | null>(null);
  const latestRuntimeContextRef = useRef({
    currentTabId,
    currentPath,
    body,
  });
  const scrolledPathRef = useRef<string | null>(null);
  const appliedEditorRef = useRef<TiptapEditor | null>(null);
  const appliedSourceVersionRef = useRef<number | null>(null);
  const [isHydrating, setIsHydrating] = useState(false);

  useEffect(() => {
    latestRuntimeContextRef.current = { currentTabId, currentPath, body };
  }, [body, currentPath, currentTabId]);

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

  const placeholder = t("editor:placeholder.document");
  const editorOptions = useMemo<Partial<EditorOptions>>(
    () => ({
      extensions: createEditorExtensions(placeholder, {
        hasFrontmatter: () => useEditorStore.getState().frontmatter !== null,
        onFrontmatterTrigger: () => {
          const store = useEditorStore.getState();
          store.setFrontmatter({});
          store.setPendingPropertyFocus(true);
          store.requestSave?.();
        },
      }),
      content: "",
      // 파일 열 때 문서 시작으로 커서 → 스크롤 상단 고정
      // 검색 결과 클릭일 땐 별도 useEffect에서 match 위치로 스크롤
      autofocus: false,
      editorProps: {
        attributes: {
          class: cn(
            "tiptap prose",
            "min-h-full px-6 pt-4 pb-10 outline-none sm:px-8 lg:px-12",
            "prose-headings:font-semibold prose-headings:tracking-tight",
            "prose-p:my-2 prose-li:my-0",
            "prose-code:before:content-none prose-code:after:content-none",
            "prose-code:rounded prose-code:bg-[var(--color-bg-tertiary)] prose-code:px-1 prose-code:py-0.5",
            "prose-pre:bg-[var(--color-bg-tertiary)] prose-pre:border prose-pre:border-[var(--color-border-primary)]",
          ),
        },
      },
    }),
    [placeholder],
  );
  const editor = useLiveEditor(currentTabId, currentPath, editorOptions);
  const showOpeningLoading = useDelayedVisible(
    isOpening,
    DOCUMENT_LOADING_DELAY_MS,
  );
  const showDocumentLoading = isHydrating || showOpeningLoading;
  const handleEditorEmptyAreaMouseDown = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      focusEditorEndOnEmptySurface(editor, event);
    },
    [editor],
  );
  const focusEditorStart = useCallback(() => {
    focusEditorStartOnNextFrame(editor);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const capture = (): DocumentRuntime | null => {
      const { currentTabId, currentPath, body } =
        latestRuntimeContextRef.current;
      if (!currentTabId || !currentPath || editor.isDestroyed) return null;
      const storage = editor.storage as unknown as {
        markdown: { getMarkdown: () => string };
      };
      const store = ws.getState();
      const selection = {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      };
      const status = store.status;
      const nextBody = storage.markdown.getMarkdown() || body;

      return {
        tabId: currentTabId,
        path: currentPath,
        body: nextBody,
        frontmatter: store.frontmatter,
        baseModified: store.baseModified,
        status,
        selection,
        editorJson: editor.getJSON(),
        scroll: captureScrollAnchor(editor, scrollRef.current),
        dirty: status.kind === "dirty" || status.kind === "conflict",
        lastAccessedAt: Date.now(),
      };
    };

    ws.getState().setActiveEditorRuntimeCapture(capture);
    return () => {
      ws.getState().captureActiveDocumentRuntime();
      ws.getState().setActiveEditorRuntimeCapture(null);
    };
  }, [editor, ws]);

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
    // Editor option changes can replace the Tiptap instance without changing
    // sourceVersion, so the new instance still needs the current body applied.
    if (appliedEditorRef.current !== editor) {
      appliedEditorRef.current = editor;
      appliedSourceVersionRef.current = null;
    }
    if (!editor) return;
    if (editor.isDestroyed) return;
    if (isOpening) {
      if (appliedSourceVersionRef.current !== sourceVersion) {
        appliedSourceVersionRef.current = sourceVersion;
        editor.commands.setContent("", { emitUpdate: false });
      }
      setIsHydrating(false);
      return;
    }
    const pathChanged = scrolledPathRef.current !== currentPath;
    scrolledPathRef.current = currentPath;

    let cancelled = false;
    let frameId = 0;
    let timerId = 0;

    const runPendingSearch = () => {
      const pending = useEditorStore.getState().pendingSearchQuery;
      const pendingLine = useEditorStore.getState().pendingJumpLine;
      if (!pending) return false;
      useEditorStore.getState().setPendingSearchQuery(null);
      requestAnimationFrame(() => {
        if (editor.isDestroyed) return;
        editor.commands.setSearchQuery(pending);
        if (pendingLine !== null && jumpToSourceLine(pendingLine)) {
          useEditorStore.getState().setPendingJumpLine(null);
        }
        setSearchOpen(true);
      });
      return true;
    };

    const restoreRuntimeViewState = () => {
      const runtime = ws.getState().getDocumentRuntime(currentTabId);
      if (!runtime) return false;
      const selection = clampSelection(
        runtime.selection,
        editor.state.doc.content.size,
      );
      if (selection) {
        editor.commands.setTextSelection(selection);
      }
      restoreCleanupRef.current?.();
      restoreCleanupRef.current = scheduleScrollAnchorRestore(
        editor,
        scrollRef.current,
        runtime.scroll,
      );
      return runtime.selection !== undefined || runtime.scroll !== undefined;
    };

    if (appliedSourceVersionRef.current !== sourceVersion) {
      appliedSourceVersionRef.current = sourceVersion;
      const applySource = () => {
        if (cancelled || editor.isDestroyed) return;
        const finishSourceApply = () => {
          setIsHydrating(false);
          const handledSearch = runPendingSearch();
          if (!handledSearch && !hasPendingSearch && currentPath) {
            const restored = restoreRuntimeViewState();
            if (!restored) focusEditorStartOnNextFrame(editor);
          }
        };
        const storage = editor.storage as unknown as {
          markdown: { getMarkdown: () => string };
        };
        if (storage.markdown.getMarkdown() === body) {
          finishSourceApply();
          return;
        }
        const runtime = ws.getState().documentRuntimes[currentTabId ?? ""];
        const runtimeJson = getRuntimeEditorJson(
          runtime ?? null,
          currentPath,
          body,
        );
        try {
          editor.commands.setContent(
            runtimeJson ?? preprocessMarkdownCached(body),
            {
              emitUpdate: false,
            },
          );
        } catch (error) {
          if (!runtimeJson) throw error;
          editor.commands.setContent(preprocessMarkdownCached(body), {
            emitUpdate: false,
          });
        }
        finishSourceApply();
      };

      if (body.length < DEFER_DOCUMENT_HYDRATION_MIN_LENGTH) {
        applySource();
        return () => {
          cancelled = true;
        };
      }

      startTransition(() => setIsHydrating(true));
      frameId = window.requestAnimationFrame(() => {
        timerId = window.setTimeout(applySource, 0);
      });
    } else {
      const handledSearch = runPendingSearch();
      // 평범하게 파일을 새로 연 경우에만 스크롤 상단으로 고정한다.
      // 입력으로 body store가 갱신될 때마다 실행하면 커서가 맨 위로 튄다.
      if (!handledSearch && pathChanged && scrollRef.current) {
        const restored = restoreRuntimeViewState();
        if (!restored) scrollRef.current.scrollTop = 0;
      }
    }

    return () => {
      cancelled = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      if (timerId) window.clearTimeout(timerId);
    };
  }, [
    editor,
    body,
    currentPath,
    currentTabId,
    hasPendingSearch,
    isOpening,
    jumpToSourceLine,
    sourceVersion,
    ws,
  ]);

  useEffect(() => {
    if (!editor || !isHydrating) return;
    const cancel = window.setTimeout(() => {
      if (editor.isDestroyed) return;
      const storage = editor.storage as unknown as {
        markdown: { getMarkdown: () => string };
      };
      if (storage.markdown.getMarkdown() === body) {
        setIsHydrating(false);
      }
    }, 3000);
    return () => window.clearTimeout(cancel);
  }, [body, editor, isHydrating]);

  useAutoSave(editor);

  useEffect(() => {
    if (!editor || !pendingJumpHeading || isHydrating) return;
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
  }, [editor, isHydrating, pendingJumpHeading]);

  useEffect(() => {
    return () => {
      restoreCleanupRef.current?.();
      restoreCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!editor || pendingJumpLine === null || isHydrating) return;
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
  }, [editor, isHydrating, jumpToSourceLine, pendingJumpLine]);

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
    <div
      className={cn(
        "relative min-h-0 min-w-0 overflow-hidden bg-[var(--color-editor-bg)]",
        className,
      )}
    >
      <SearchBar
        editor={editor}
        open={searchOpen}
        onClose={handleSearchClose}
      />
      {showDocumentLoading ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute top-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-md border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] shadow-[var(--shadow-popover)]"
        >
          <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[var(--color-text-tertiary)]" />
          <span>{t("editor:documentLoading.title")}</span>
        </div>
      ) : null}
      <div
        ref={scrollRef}
        className="h-full min-w-0 overflow-y-auto bg-[var(--color-editor-bg)]"
        onMouseDown={handleEditorEmptyAreaMouseDown}
      >
        <EditorTitleInput onSubmitTitle={focusEditorStart} />
        <ErrorBoundary scope="properties-panel" inline>
          <PropertiesPanel />
        </ErrorBoundary>
        <BubbleMenuBar editor={editor} />
        <TableMenu editor={editor} />
        {editor ? (
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
        ) : null}
        {blockMenu && editor && (
          <BlockMenu
            editor={editor}
            pos={blockMenu.pos}
            anchor={blockMenu.anchor}
            onClose={handleBlockMenuClose}
          />
        )}
        <div className="munix-editor-content-surface">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
