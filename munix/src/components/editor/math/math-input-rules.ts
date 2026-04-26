import { Extension, InputRule } from "@tiptap/core";

/**
 * 라이브 입력 시 `$latex$` 패턴을 InlineMath 노드로 변환.
 * - `$` 로 시작, 내부에 `$` 없음, 닫는 `$` 직후 비-`$` 문자 또는 종료
 * - 코드 블록/코드 마크 안에서는 트리거되지 않도록 input rule 자체가 inline 컨텍스트만 동작.
 *
 * 블록 수식은 `$$\n...\n$$` 자체 라인 형태로 preprocessMarkdown 단계에서만 처리.
 * 라이브 입력으로 블록 수식 진입은 v1 범위 외 (사용자가 줄바꿈으로 편집 후 reload 시 인식).
 */
export const MathInputRules = Extension.create({
  name: "mathInputRules",

  addInputRules() {
    return [
      new InputRule({
        // 종료 트리거 문자(공백/punct/end)는 정규식 외부에서 자르고, 매치는 `$...$`만.
        find: /(?:^|[\s(])(\$([^\s$][^$\n]*?[^\s$]|[^\s$])\$)$/,
        handler: ({ range, match, chain }) => {
          const fullMatch = match[1];
          const latex = match[2];
          if (!fullMatch || !latex) return;
          // 매치 시작 위치: range.from + (전체 - $...$ 길이)
          const startOffset = match[0].length - fullMatch.length;
          const from = range.from + startOffset;
          const to = range.to;
          chain()
            .deleteRange({ from, to })
            .insertContentAt(from, [
              {
                type: "inlineMath",
                attrs: { latex },
              },
              { type: "text", text: " " },
            ])
            .run();
        },
      }),
    ];
  },
});
