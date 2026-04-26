import { useEffect, useState } from "react";
import {
  NodeViewWrapper,
  NodeViewContent,
  type NodeViewProps,
} from "@tiptap/react";
import { cn } from "@/lib/cn";

/**
 * 각주 정의 NodeView. 본문에 매칭 `[^id]` 참조가 없으면 옅은 색으로 표시.
 *
 * inline content는 `NodeViewContent`로 그대로 노출 (마크다운/링크/강조 보존).
 */
export function FootnoteBlockView({ node }: NodeViewProps) {
  const id = (node.attrs.id as string) ?? "";
  const [hasRef, setHasRef] = useState<boolean>(true);

  useEffect(() => {
    if (!id) {
      setHasRef(false);
      return;
    }
    const check = () => {
      const el = document.querySelector(
        `[data-fnref="${cssEscape(id)}"]`,
      ) as HTMLElement | null;
      setHasRef(!!el);
    };
    check();
    const root = document.querySelector(".tiptap");
    if (!root) return;
    const observer = new MutationObserver(() => check());
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [id]);

  return (
    <NodeViewWrapper
      as="div"
      className={cn("munix-fn-def", !hasRef && "munix-fn-def-unused")}
      data-fndef={id}
    >
      <span className="munix-fn-def-label" contentEditable={false}>
        [{id}]
      </span>
      <NodeViewContent<"span"> as="span" className="munix-fn-def-body" />
    </NodeViewWrapper>
  );
}

function cssEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
