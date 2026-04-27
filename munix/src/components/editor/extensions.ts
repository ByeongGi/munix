import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { VaultImage } from "./image-node";
import { ImagePaste } from "./image-paste";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Markdown } from "tiptap-markdown";
import { createLowlight, common } from "lowlight";
import { SlashCommand } from "./slash-menu/slash-command";
import { TableDeleteFix } from "./table-delete-fix";
import { SearchHighlight } from "./search-highlight";
import { CodeBlockWithLang } from "./code-block-node";
import { CalloutDecoration } from "./callout-decoration";
import { MunixHighlight } from "./highlight-ext";
import { Wikilink } from "./wikilink/wikilink-node";
import { WikilinkSuggestion } from "./wikilink/wikilink-suggestion";
import { WikilinkClick } from "./wikilink/wikilink-click";
import { MarkdownLinkClick } from "./markdown-link-click";
import { HorizontalRuleNode } from "./horizontal-rule-node";
import { HorizontalRuleEnter } from "./horizontal-rule-enter";
import { BlockShortcuts } from "./block-shortcuts";
import { IndentShortcuts } from "./indent-shortcuts";
import { HeadingFold } from "./heading-fold";
import { InlineMath, BlockMath, MathInputRules } from "./math";
import { FootnoteRef, FootnoteBlock } from "./footnote";
import { createFrontmatterTrigger } from "./frontmatter-trigger";

const lowlight = createLowlight(common);

interface EditorExtensionOptions {
  hasFrontmatter?: () => boolean;
  onFrontmatterTrigger?: () => void;
}

export function createEditorExtensions(
  placeholder: string,
  options: EditorExtensionOptions = {},
) {
  return [
    StarterKit.configure({
      codeBlock: false,
      horizontalRule: false,
    }),
    HorizontalRuleNode,
    CodeBlockWithLang.configure({
      lowlight,
      defaultLanguage: "plaintext",
    }),
    Placeholder.configure({
      placeholder,
      emptyEditorClass:
        "is-editor-empty before:content-[attr(data-placeholder)] before:float-left before:text-[var(--color-text-tertiary)] before:pointer-events-none before:h-0",
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      protocols: ["http", "https", "mailto"],
    }),
    VaultImage,
    ImagePaste,
    Table.configure({ resizable: true, allowTableNodeSelection: true }),
    TableRow,
    TableHeader,
    TableCell,
    TableDeleteFix,
    MunixHighlight,
    Markdown.configure({
      html: true, // `<mark>` (highlight), `<details>` (toggle) 인라인 HTML 허용
      tightLists: true,
      bulletListMarker: "-",
      linkify: true,
      breaks: false,
      transformPastedText: true,
      transformCopiedText: true,
    }),
    SlashCommand,
    SearchHighlight,
    CalloutDecoration,
    Wikilink,
    WikilinkSuggestion,
    WikilinkClick,
    MarkdownLinkClick,
    HorizontalRuleEnter,
    BlockShortcuts,
    IndentShortcuts,
    HeadingFold,
    InlineMath,
    BlockMath,
    MathInputRules,
    FootnoteRef,
    FootnoteBlock,
    createFrontmatterTrigger({
      hasFrontmatter: options.hasFrontmatter ?? (() => false),
      onTrigger: options.onFrontmatterTrigger ?? (() => {}),
    }),
  ];
}
