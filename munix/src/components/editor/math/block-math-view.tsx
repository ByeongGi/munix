import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

/** 블록 수식 NodeView. selected 시 raw `$$...$$` textarea 편집 (image-node 패턴). */
export function BlockMathView({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const { t } = useTranslation(["editor"]);
  const latex = (node.attrs.latex as string) ?? "";
  const [draft, setDraft] = useState<string>(latex);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // node attrs가 외부에서 바뀌면 draft 동기화
  useEffect(() => {
    setDraft(latex);
  }, [latex]);

  // 선택되면 textarea 자동 포커스
  useEffect(() => {
    if (selected) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [selected]);

  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      return `<span class="munix-math-error">${escapeHtml(latex)}</span>`;
    }
  }, [latex]);

  const commit = () => {
    if (draft !== latex) {
      updateAttributes({ latex: draft });
    }
  };

  return (
    <NodeViewWrapper
      as="div"
      className={cn(
        "munix-math-block-wrapper relative my-3 rounded border px-3 py-2",
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-bg-tertiary)]"
          : "border-transparent",
      )}
      data-drag-handle
    >
      <div
        className="munix-math-block-render overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {selected && (
        <div
          contentEditable={false}
          className={cn(
            "mt-2 flex flex-col gap-1 rounded",
            "bg-[var(--color-bg-secondary-solid)] px-2 py-1.5",
            "border border-[var(--color-border-secondary)]",
          )}
        >
          <span className="text-[10px] uppercase text-[var(--color-text-tertiary)]">
            tex (block)
          </span>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              // Enter는 줄바꿈 허용. Cmd/Ctrl+Enter 또는 Esc로 종료.
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                commit();
                textareaRef.current?.blur();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setDraft(latex);
                textareaRef.current?.blur();
              }
            }}
            placeholder={t("editor:math.blockPlaceholder")}
            rows={Math.max(2, draft.split("\n").length)}
            className={cn(
              "w-full bg-transparent px-1 py-0.5 text-xs outline-none font-mono resize-y",
              "text-[var(--color-text-primary)]",
              "placeholder:text-[var(--color-text-tertiary)]",
            )}
          />
        </div>
      )}
    </NodeViewWrapper>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
