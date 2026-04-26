import Highlight from "@tiptap/extension-highlight";
import { markInputRule, markPasteRule } from "@tiptap/core";

/**
 * Obsidian 스타일 `==text==` 하이라이트.
 *
 * - Tiptap의 Highlight mark + `<mark>` HTML 파싱 기본 제공
 * - tiptap-markdown이 mark 직렬화를 하기 위한 storage.markdown.serialize 설정
 * - 라이브 입력은 InputRule로 처리
 * - 기존 .md 로딩은 openFile 레벨에서 `==text==` → `<mark>text</mark>` 전처리 (html: true 필요)
 */
export const MunixHighlight = Highlight.extend({
  addStorage() {
    return {
      markdown: {
        serialize: {
          open: "==",
          close: "==",
          mixable: true,
          expelEnclosingWhitespace: true,
        },
        parse: {},
      },
    };
  },
  addInputRules() {
    return [
      markInputRule({
        find: /(?:^|\s)(==([^=]+)==)$/,
        type: this.type,
      }),
    ];
  },
  addPasteRules() {
    return [
      markPasteRule({
        find: /==([^=]+)==/g,
        type: this.type,
      }),
    ];
  },
});
