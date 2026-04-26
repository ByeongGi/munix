/* eslint-disable react-refresh/only-export-components --
 * NodeView 컴포넌트(CodeBlockView)와 Tiptap extension(CodeBlockWithLang)을 같이
 * export. image-node.tsx와 동일 패턴 — extension은 fast-refresh 대상 아님.
 */
import { useState } from "react";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Copy, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { ipc } from "@/lib/ipc";

function CodeBlockView({ node, updateAttributes, extension }: NodeViewProps) {
  const { t } = useTranslation(["editor"]);
  const lowlight = extension.options.lowlight as {
    listLanguages: () => string[];
  };
  // lowlight 가 이미 `plaintext` 를 포함하므로 dedupe — 중복 시 React key 충돌 경고.
  const languages = Array.from(
    new Set(["plaintext", ...lowlight.listLanguages()]),
  ).sort();
  const current = (node.attrs.language as string | null) ?? "plaintext";
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await ipc.copyText(node.textContent ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <NodeViewWrapper className="munix-codeblock relative my-4">
      <div
        contentEditable={false}
        className="absolute right-2 top-2 z-10 flex items-center gap-1"
      >
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
      <pre>
        <NodeViewContent />
      </pre>
    </NodeViewWrapper>
  );
}

/** CodeBlockLowlight 확장 + 언어 드롭다운 + 복사 버튼.
 * Tab → 2 공백, Shift+Tab → 줄 시작 2 공백 제거. 코드 블록 안에서만 동작.
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
        editor.commands.insertContent("  ");
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
        // 줄 시작 2글자가 공백이면 제거
        const head = state.doc.textBetween(
          lineStartPos,
          Math.min(lineStartPos + 2, $from.pos),
          "\n",
        );
        let removeLen = 0;
        if (head.startsWith("  ")) removeLen = 2;
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
