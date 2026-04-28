import type { Editor, Range } from "@tiptap/core";
import type { LucideIcon } from "lucide-react";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Code,
  Quote,
  Minus,
  Table as TableIcon,
  Info,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";

export interface SlashCommandContext {
  editor: Editor;
  range: Range;
}

export type SlashGroup = "heading" | "list" | "block" | "callout";

/**
 * SlashItem — i18n 친화 형태.
 *
 * 모듈 레벨에서 직접 t() 를 호출하지 않기 위해 `titleKey`, `descKey` 를 둔다.
 * 렌더 단계에서 `t(titleKey)` 형식으로 적용한다 (i18next 의 ns 분리: editor.json).
 *
 * `searchTerms` 는 다국어 키워드를 모두 포함 (영문 + 한국어). UI 언어가 바뀌어도
 * 검색은 양쪽 언어 모두 매칭되어야 한다.
 */
export interface SlashItem {
  id: string;
  titleKey: string;
  descKey: string;
  searchTerms: string[];
  icon: LucideIcon;
  group: SlashGroup;
  run: (ctx: SlashCommandContext) => void;
}

/** 그룹 표시 순서. 검색 시에도 같은 순서. */
export const SLASH_GROUP_ORDER: SlashGroup[] = [
  "heading",
  "list",
  "block",
  "callout",
];

/**
 * 콜아웃 본문 placeholder 텍스트는 i18n 적용이 까다로워 (모듈 시점) 한국어 그대로 둔다.
 * UI 언어 영어인 사용자가 콜아웃을 삽입하면 placeholder 가 영문으로 보이는 게 더 자연스러우므로
 * `getSlashItems(t)` 형태로 t 를 받는다.
 */
export function getSlashItems(
  t: (key: string) => string,
): SlashItem[] {
  const calloutContent = t("editor:slashCommands.calloutContent");

  return [
    {
      id: "heading1",
      titleKey: "editor:slashCommands.heading1.title",
      descKey: "editor:slashCommands.heading1.description",
      searchTerms: ["h1", "heading1", "heading", "제목"],
      icon: Heading1,
      group: "heading",
      run: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 1 })
          .run();
      },
    },
    {
      id: "heading2",
      titleKey: "editor:slashCommands.heading2.title",
      descKey: "editor:slashCommands.heading2.description",
      searchTerms: ["h2", "heading2", "heading", "제목"],
      icon: Heading2,
      group: "heading",
      run: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 2 })
          .run();
      },
    },
    {
      id: "heading3",
      titleKey: "editor:slashCommands.heading3.title",
      descKey: "editor:slashCommands.heading3.description",
      searchTerms: ["h3", "heading3", "heading", "제목"],
      icon: Heading3,
      group: "heading",
      run: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode("heading", { level: 3 })
          .run();
      },
    },
    {
      id: "bulletList",
      titleKey: "editor:slashCommands.bulletList.title",
      descKey: "editor:slashCommands.bulletList.description",
      searchTerms: ["bullet", "list", "unordered", "ul", "목록", "글머리"],
      icon: List,
      group: "list",
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      id: "orderedList",
      titleKey: "editor:slashCommands.orderedList.title",
      descKey: "editor:slashCommands.orderedList.description",
      searchTerms: ["ordered", "numbered", "ol", "list", "번호", "목록"],
      icon: ListOrdered,
      group: "list",
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      id: "taskList",
      titleKey: "editor:slashCommands.taskList.title",
      descKey: "editor:slashCommands.taskList.description",
      searchTerms: ["todo", "task", "check", "checklist", "할일", "할 일"],
      icon: ListTodo,
      group: "list",
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      id: "codeBlock",
      titleKey: "editor:slashCommands.codeBlock.title",
      descKey: "editor:slashCommands.codeBlock.description",
      searchTerms: ["code", "pre", "코드", "코드 블록"],
      icon: Code,
      group: "block",
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      id: "mermaid",
      titleKey: "editor:slashCommands.mermaid.title",
      descKey: "editor:slashCommands.mermaid.description",
      searchTerms: [
        "mermaid",
        "diagram",
        "flowchart",
        "sequence",
        "chart",
        "graph",
        "다이어그램",
        "플로우차트",
      ],
      icon: Code,
      group: "block",
      run: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setCodeBlock({ language: "mermaid" })
          .insertContent("flowchart TD\n  A[Start] --> B[End]")
          .run();
      },
    },
    {
      id: "blockquote",
      titleKey: "editor:slashCommands.blockquote.title",
      descKey: "editor:slashCommands.blockquote.description",
      searchTerms: ["quote", "blockquote", "인용"],
      icon: Quote,
      group: "block",
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      id: "horizontalRule",
      titleKey: "editor:slashCommands.horizontalRule.title",
      descKey: "editor:slashCommands.horizontalRule.description",
      searchTerms: ["divider", "hr", "separator", "구분", "구분선"],
      icon: Minus,
      group: "block",
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      id: "table",
      titleKey: "editor:slashCommands.table.title",
      descKey: "editor:slashCommands.table.description",
      searchTerms: ["table", "grid", "표"],
      icon: TableIcon,
      group: "block",
      run: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
    {
      id: "calloutInfo",
      titleKey: "editor:slashCommands.calloutInfo.title",
      descKey: "editor:slashCommands.calloutInfo.description",
      searchTerms: ["callout", "info", "note", "admonition", "강조", "정보"],
      icon: Info,
      group: "callout",
      run: ({ editor, range }) => {
        insertCallout(editor, range, "INFO", false, calloutContent);
      },
    },
    {
      id: "calloutTip",
      titleKey: "editor:slashCommands.calloutTip.title",
      descKey: "editor:slashCommands.calloutTip.description",
      searchTerms: ["callout", "tip", "hint", "팁"],
      icon: Lightbulb,
      group: "callout",
      run: ({ editor, range }) => {
        insertCallout(editor, range, "TIP", false, calloutContent);
      },
    },
    {
      id: "calloutWarning",
      titleKey: "editor:slashCommands.calloutWarning.title",
      descKey: "editor:slashCommands.calloutWarning.description",
      searchTerms: ["callout", "warning", "caution", "경고"],
      icon: AlertTriangle,
      group: "callout",
      run: ({ editor, range }) => {
        insertCallout(editor, range, "WARNING", false, calloutContent);
      },
    },
    {
      id: "calloutSuccess",
      titleKey: "editor:slashCommands.calloutSuccess.title",
      descKey: "editor:slashCommands.calloutSuccess.description",
      searchTerms: ["callout", "success", "done", "성공"],
      icon: CheckCircle2,
      group: "callout",
      run: ({ editor, range }) => {
        insertCallout(editor, range, "SUCCESS", false, calloutContent);
      },
    },
    {
      id: "calloutToggle",
      titleKey: "editor:slashCommands.calloutToggle.title",
      descKey: "editor:slashCommands.calloutToggle.description",
      searchTerms: ["toggle", "fold", "details", "접기", "토글"],
      icon: CheckCircle2,
      group: "callout",
      run: ({ editor, range }) => {
        insertCallout(editor, range, "NOTE", true, calloutContent);
      },
    },
  ];
}

function insertCallout(
  editor: Editor,
  range: Range,
  kind: string,
  foldable: boolean,
  contentText: string,
): void {
  const marker = `[!${kind}]${foldable ? "+" : ""}`;
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent({
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: marker }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: contentText }],
        },
      ],
    })
    .run();
}

/**
 * 검색 필터. `query` 는 lowercase 비교.
 *
 * - title 매칭: 양쪽 언어로 번역된 title 모두 검사 (현재 활성 언어가 무엇이든
 *   양쪽 언어 키워드로 검색되도록 — searchTerms 에 양 언어 키워드 포함).
 * - searchTerms 매칭: 부분 문자열 inclusive.
 *
 * t 는 현재 활성 언어 기준으로 title 매칭 (UI 표시 텍스트 그대로 검색되도록).
 */
export function filterSlashItems(
  items: SlashItem[],
  query: string,
  t: (key: string) => string,
): SlashItem[] {
  if (!query) return items;
  const q = query.toLowerCase();
  return items.filter((item) => {
    if (t(item.titleKey).toLowerCase().includes(q)) return true;
    return item.searchTerms.some((term) => term.toLowerCase().includes(q));
  });
}
