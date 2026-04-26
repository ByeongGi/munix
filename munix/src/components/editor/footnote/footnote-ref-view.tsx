import { useEffect, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

/**
 * 각주 참조 NodeView. 위첨자 `[id]` 표시 + 클릭 시 정의로 스크롤.
 *
 * - 정의(`[data-fndef='id']`)가 문서에 없으면 점선 스타일로 미정의 힌트.
 * - DOM 변경 감지를 위해 MutationObserver를 사용해 정의 존재 여부를 주기적으로
 *   재평가 (Tiptap 트랜잭션마다 정확히 동기화하지 않아도 사용자가 정의를
 *   추가/삭제할 때 시각 힌트가 갱신됨).
 */
export function FootnoteRefView({ node }: NodeViewProps) {
  const { t } = useTranslation(["editor"]);
  const id = (node.attrs.id as string) ?? "";
  const [defined, setDefined] = useState<boolean>(true);

  useEffect(() => {
    if (!id) {
      setDefined(false);
      return;
    }
    const check = () => {
      const el = document.querySelector(
        `[data-fndef="${cssEscape(id)}"]`,
      ) as HTMLElement | null;
      setDefined(!!el);
    };
    check();
    // ProseMirror DOM 트리 변화에 따라 재평가
    const root = document.querySelector(".tiptap");
    if (!root) return;
    const observer = new MutationObserver(() => check());
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [id]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!id) return;
    const target = document.querySelector(
      `[data-fndef="${cssEscape(id)}"]`,
    ) as HTMLElement | null;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <NodeViewWrapper
      as="sup"
      className={cn(
        "munix-fn-ref cursor-pointer select-none",
        !defined && "munix-fn-ref-undefined",
      )}
      data-fnref={id}
      data-drag-handle
      onClick={handleClick}
      title={
        defined
          ? t("editor:footnote.jumpTo", { id })
          : t("editor:footnote.undefined", { id })
      }
    >
      [{id}]
    </NodeViewWrapper>
  );
}

/** CSS attribute selector에 안전하게 쓰기 위해 따옴표/백슬래시 escape. */
function cssEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
