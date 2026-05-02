import { useEffect, useMemo, useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { renderMathToString } from "./render-cache";

/** 인라인 수식 NodeView. selected 시 raw `$latex$` input으로 편집 가능 (image-node 패턴). */
export function InlineMathView({
  node,
  updateAttributes,
  selected,
}: NodeViewProps) {
  const { t } = useTranslation(["editor"]);
  const latex = (node.attrs.latex as string) ?? "";
  const [draft, setDraft] = useState<string>(latex);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // node attrs가 외부에서 바뀌면 draft 동기화
  useEffect(() => {
    setDraft(latex);
  }, [latex]);

  // 선택되면 input 자동 포커스
  useEffect(() => {
    if (selected) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [selected]);

  const html = useMemo(() => renderMathToString(latex, false), [latex]);

  const commit = () => {
    if (draft !== latex) {
      updateAttributes({ latex: draft });
    }
  };

  return (
    <NodeViewWrapper
      as="span"
      className="relative inline-block align-baseline"
      data-drag-handle
    >
      <span
        className={cn(
          "munix-math-inline cursor-pointer rounded px-0.5",
          selected && "ring-2 ring-[var(--color-accent)]",
        )}
        // KaTeX 결과는 trusted (자체 라이브러리 출력) — innerHTML 주입 OK
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {selected && (
        <span
          contentEditable={false}
          className={cn(
            "absolute left-0 top-full z-10 mt-1 flex items-center gap-1 rounded",
            "bg-[var(--color-bg-secondary-solid)] px-2 py-1",
            "border border-[var(--color-border-secondary)] shadow-sm",
            "min-w-[200px]",
          )}
        >
          <span className="text-[10px] uppercase text-[var(--color-text-tertiary)]">
            tex
          </span>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
                inputRef.current?.blur();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setDraft(latex);
                inputRef.current?.blur();
              }
            }}
            placeholder={t("editor:math.inlinePlaceholder")}
            className={cn(
              "flex-1 bg-transparent px-1 py-0 text-xs outline-none font-mono",
              "text-[var(--color-text-primary)]",
              "placeholder:text-[var(--color-text-tertiary)]",
            )}
          />
        </span>
      )}
    </NodeViewWrapper>
  );
}
