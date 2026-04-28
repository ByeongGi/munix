/* eslint-disable react-refresh/only-export-components --
 * NodeView 컴포넌트(CodeBlockView)와 Tiptap extension(CodeBlockWithLang)을 같이
 * export. image-node.tsx와 동일 패턴 — extension은 fast-refresh 대상 아님.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Copy, Check, Pencil, Eye, AlertTriangle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { ipc } from "@/lib/ipc";

const MERMAID_LANGUAGE = "mermaid";
const MERMAID_RENDER_ROOT_MARGIN = "800px 0px";
const MERMAID_RENDER_DEBOUNCE_MS = 80;
const MERMAID_RENDER_IDLE_TIMEOUT_MS = 1200;
const MERMAID_RENDER_CACHE_LIMIT = 80;

interface MermaidRenderResult {
  svg: string;
  error: string | null;
}

const mermaidRenderCache = new Map<string, MermaidRenderResult>();
let mermaidRenderQueue = Promise.resolve();
let mermaidModulePromise: ReturnType<typeof importMermaid> | null = null;

function isMermaidLanguage(language: string | null | undefined): boolean {
  return language?.trim().split(/\s+/)[0]?.toLowerCase() === MERMAID_LANGUAGE;
}

function isSelectionInsideNode(editor: Editor, getPos: NodeViewProps["getPos"]) {
  const pos = typeof getPos === "function" ? getPos() : null;
  if (typeof pos !== "number") return false;
  const { from, to } = editor.state.selection;
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return false;
  return from >= pos && to <= pos + node.nodeSize;
}

function getMermaidTheme(): "default" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "default"
    : "dark";
}

function enqueueMermaidRender(
  task: () => Promise<MermaidRenderResult>,
): Promise<MermaidRenderResult> {
  const run = mermaidRenderQueue.then(task, task);
  mermaidRenderQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function importMermaid() {
  return (await import("mermaid")).default;
}

function loadMermaid() {
  mermaidModulePromise ??= importMermaid();
  return mermaidModulePromise;
}

function readMermaidCache(key: string): MermaidRenderResult | null {
  const cached = mermaidRenderCache.get(key);
  if (!cached) return null;
  mermaidRenderCache.delete(key);
  mermaidRenderCache.set(key, cached);
  return cached;
}

function writeMermaidCache(key: string, result: MermaidRenderResult): void {
  mermaidRenderCache.set(key, result);
  if (mermaidRenderCache.size <= MERMAID_RENDER_CACHE_LIMIT) return;
  const oldest = mermaidRenderCache.keys().next().value;
  if (oldest) mermaidRenderCache.delete(oldest);
}

function scheduleMermaidRender(callback: () => void): () => void {
  let cleanup: () => void = () => {};
  const timer = window.setTimeout(() => {
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(callback, {
        timeout: MERMAID_RENDER_IDLE_TIMEOUT_MS,
      });
      cleanup = () => window.cancelIdleCallback(idleId);
      return;
    }
    callback();
  }, MERMAID_RENDER_DEBOUNCE_MS);

  cleanup = () => window.clearTimeout(timer);
  return () => cleanup();
}

function CodeBlockView({
  node,
  updateAttributes,
  extension,
  editor,
  getPos,
}: NodeViewProps) {
  const { t } = useTranslation(["editor"]);
  const lowlight = extension.options.lowlight as {
    listLanguages: () => string[];
  };
  // lowlight 가 이미 `plaintext` 를 포함하므로 dedupe — 중복 시 React key 충돌 경고.
  const current = (node.attrs.language as string | null) ?? "plaintext";
  const languages = useMemo(
    () =>
      Array.from(
        new Set([
          "plaintext",
          MERMAID_LANGUAGE,
          current,
          ...lowlight.listLanguages(),
        ]),
      )
        .filter(Boolean)
        .sort(),
    [current, lowlight],
  );
  const isMermaid = isMermaidLanguage(current);
  const [copied, setCopied] = useState(false);
  const [isEditingMermaid, setIsEditingMermaid] = useState(false);

  const onCopy = async () => {
    try {
      await ipc.copyText(node.textContent ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!isMermaid) return;

    const syncEditMode = () => {
      if (!isSelectionInsideNode(editor, getPos)) setIsEditingMermaid(false);
    };

    editor.on("selectionUpdate", syncEditMode);
    editor.on("blur", syncEditMode);
    return () => {
      editor.off("selectionUpdate", syncEditMode);
      editor.off("blur", syncEditMode);
    };
  }, [editor, getPos, isMermaid]);

  const showMermaidPreview = isMermaid && !isEditingMermaid;

  return (
    <NodeViewWrapper
      className={cn(
        "munix-codeblock relative my-4",
        isMermaid && "munix-mermaid-block",
      )}
      onDoubleClick={() => {
        if (isMermaid) setIsEditingMermaid(true);
      }}
    >
      <div
        contentEditable={false}
        className="absolute right-2 top-2 z-10 flex items-center gap-1"
      >
        {isMermaid ? (
          <button
            type="button"
            onClick={() => setIsEditingMermaid((value) => !value)}
            className={cn(
              "flex h-6 items-center gap-1 rounded border px-1.5 text-[11px]",
              "border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)]",
              "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]",
              "opacity-0 transition-opacity",
            )}
            aria-label={
              showMermaidPreview
                ? t("editor:mermaid.edit")
                : t("editor:mermaid.preview")
            }
          >
            {showMermaidPreview ? (
              <>
                <Pencil className="h-3 w-3" />
                <span>{t("editor:mermaid.editLabel")}</span>
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                <span>{t("editor:mermaid.previewLabel")}</span>
              </>
            )}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            "flex h-6 items-center gap-1 rounded border px-1.5 text-[11px]",
            "border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)]",
            "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]",
            "opacity-0 transition-opacity",
          )}
          aria-label={t("editor:codeBlock.copy")}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-[var(--color-success)]" />
              <span>{t("editor:codeBlock.copied")}</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>{t("editor:codeBlock.copyLabel")}</span>
            </>
          )}
        </button>
        <select
          value={current}
          onChange={(e) => updateAttributes({ language: e.target.value })}
          className={cn(
            "h-6 rounded border px-1 text-[11px]",
            "border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)]",
            "text-[var(--color-text-tertiary)] outline-none",
            "focus:border-[var(--color-accent)]",
          )}
        >
          {languages.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>
      {showMermaidPreview ? (
        <MermaidPreview source={node.textContent} />
      ) : null}
      <pre className={showMermaidPreview ? "sr-only" : undefined}>
        <NodeViewContent />
      </pre>
    </NodeViewWrapper>
  );
}

function MermaidPreview({ source }: { source: string }) {
  const { t } = useTranslation(["editor"]);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    if (!("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { root: null, rootMargin: MERMAID_RENDER_ROOT_MARGIN },
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const target = container;
    const theme = getMermaidTheme();
    const cacheKey = `${theme}\n${source}`;

    async function renderMermaid() {
      const cached = readMermaidCache(cacheKey);
      if (cached) {
        target.innerHTML = cached.svg;
        setError(cached.error);
        return;
      }

      setIsRendering(true);
      try {
        const result = await enqueueMermaidRender(async () => {
          const mermaid = await loadMermaid();
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme,
          });
          const renderResult = await mermaid.render(
            `munix-mermaid-${crypto.randomUUID()}`,
            source || "\n",
          );
          return { svg: renderResult.svg, error: null };
        });
        if (cancelled) return;
        writeMermaidCache(cacheKey, result);
        target.innerHTML = result.svg;
        setError(result.error);
      } catch (err) {
        if (cancelled) return;
        const result = {
          svg: "",
          error: err instanceof Error ? err.message : String(err),
        };
        writeMermaidCache(cacheKey, result);
        target.innerHTML = "";
        setError(result.error);
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    }

    const cancelScheduledRender = scheduleMermaidRender(
      () => void renderMermaid(),
    );
    return () => {
      cancelled = true;
      cancelScheduledRender();
    };
  }, [isVisible, source]);

  return (
    <div
      ref={wrapperRef}
      contentEditable={false}
      className="munix-mermaid-preview"
    >
      <div ref={containerRef} className="munix-mermaid-canvas" />
      {!isVisible || isRendering ? (
        <div className="munix-mermaid-placeholder" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" />
          <span>{t("editor:mermaid.rendering")}</span>
          <div className="munix-mermaid-placeholder-lines" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="munix-mermaid-error" role="status">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">{t("editor:mermaid.renderError")}</div>
            <pre>{error}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** CodeBlockLowlight 확장 + 언어 드롭다운 + 복사 버튼.
 * Tab → 탭 문자, Shift+Tab → 줄 시작 탭/공백 제거. 코드 블록 안에서만 동작.
 */
export const CodeBlockWithLang = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
  addKeyboardShortcuts() {
    const parent = this.parent?.() ?? {};
    return {
      ...parent,
      Tab: ({ editor }) => {
        if (!editor.isActive("codeBlock")) return false;
        editor.commands.insertContent("\t");
        return true;
      },
      "Shift-Tab": ({ editor }) => {
        if (!editor.isActive("codeBlock")) return false;
        const { state } = editor;
        const { $from } = state.selection;
        // 현재 줄의 시작 위치 = block 시작 + 그 안의 마지막 \n 다음
        const blockStart = $from.start();
        const before = state.doc.textBetween(blockStart, $from.pos, "\n");
        const lineStartInBlock = before.lastIndexOf("\n") + 1;
        const lineStartPos = blockStart + lineStartInBlock;
        // 줄 시작의 탭 문자 또는 공백 들여쓰기를 제거
        const head = state.doc.textBetween(
          lineStartPos,
          Math.min(lineStartPos + 4, $from.pos),
          "\n",
        );
        let removeLen = 0;
        if (head.startsWith("\t")) removeLen = 1;
        else if (head.startsWith("    ")) removeLen = 4;
        else if (head.startsWith("  ")) removeLen = 2;
        else if (head.startsWith(" ")) removeLen = 1;
        if (removeLen === 0) return true; // 코드 블록 안이면 항상 동작 흡수
        editor
          .chain()
          .focus()
          .deleteRange({ from: lineStartPos, to: lineStartPos + removeLen })
          .run();
        return true;
      },
    };
  },
});
