import { Extension, type Editor } from "@tiptap/core";
import { DOMSerializer, type Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { EditorCopyMode } from "@/types/editor-clipboard";

export const MARKDOWN_CLIPBOARD_TYPES = [
  "text/markdown",
  "text/x-markdown",
] as const;

export interface StandardClipboardPayload {
  html: string;
  markdown: string;
  plainText: string;
}

export type ClipboardMimeData = Partial<Record<string, string>>;

interface MarkdownStorage {
  markdown?: {
    serializer?: {
      serialize: (content: Slice["content"]) => string;
    };
  };
}

const UNSTABLE_CLIPBOARD_CLASS_RE =
  /^(ProseMirror|is-editor-empty|has-focus|selectedCell|munix-)/;

const BLOCK_TAG_NAMES = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIELDSET",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TR",
  "UL",
]);

function shouldUseNativeClipboard(event: ClipboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='false']"),
  );
}

function cleanClipboardHtml(container: HTMLElement): void {
  normalizeRichClipboardHtml(container);

  for (const element of Array.from(
    container.querySelectorAll<HTMLElement>("*"),
  )) {
    element.removeAttribute("data-pm-slice");
    element.removeAttribute("data-wikilink-target");
    element.removeAttribute("data-wikilink-alias");
    element.removeAttribute("data-math-inline");
    element.removeAttribute("data-math-block");
    element.removeAttribute("data-fnref");
    element.removeAttribute("data-fndef");
    element.removeAttribute("data-munix-horizontal-rule");
    element.removeAttribute("contenteditable");
    element.removeAttribute("draggable");
    element.removeAttribute("spellcheck");

    const className = element.getAttribute("class");
    if (!className) continue;

    const stableClassName = className
      .split(/\s+/)
      .filter((token) => token && !UNSTABLE_CLIPBOARD_CLASS_RE.test(token))
      .join(" ");

    if (stableClassName) {
      element.setAttribute("class", stableClassName);
    } else {
      element.removeAttribute("class");
    }
  }
}

function replaceElement(
  element: Element,
  tagName: string,
  attrs: Record<string, string | null>,
  textContent?: string,
): HTMLElement {
  const next = element.ownerDocument.createElement(tagName);
  for (const [name, value] of Object.entries(attrs)) {
    if (value) next.setAttribute(name, value);
  }
  if (textContent !== undefined) next.textContent = textContent;
  element.replaceWith(next);
  return next;
}

function normalizeRichClipboardHtml(container: HTMLElement): void {
  for (const rule of Array.from(
    container.querySelectorAll<HTMLElement>("[data-munix-horizontal-rule]"),
  )) {
    replaceElement(rule, "hr", {});
  }

  for (const wikilink of Array.from(
    container.querySelectorAll<HTMLElement>("[data-wikilink-target]"),
  )) {
    const target = wikilink.getAttribute("data-wikilink-target") ?? "";
    const alias = wikilink.getAttribute("data-wikilink-alias");
    const label = alias || target || wikilink.textContent || "";
    replaceElement(wikilink, "a", { href: target || null }, label);
  }

  for (const footnoteRef of Array.from(
    container.querySelectorAll<HTMLElement>("sup[data-fnref]"),
  )) {
    const id = footnoteRef.getAttribute("data-fnref") ?? "";
    footnoteRef.textContent = id || footnoteRef.textContent;
  }

  for (const inlineMath of Array.from(
    container.querySelectorAll<HTMLElement>("[data-math-inline]"),
  )) {
    const latex = inlineMath.getAttribute("data-math-inline") ?? "";
    inlineMath.textContent = `$${latex}$`;
  }

  for (const blockMath of Array.from(
    container.querySelectorAll<HTMLElement>("[data-math-block]"),
  )) {
    const latex = blockMath.getAttribute("data-math-block") ?? "";
    blockMath.textContent = `$$\n${latex}\n$$`;
  }

  for (const mark of Array.from(
    container.querySelectorAll<HTMLElement>("mark"),
  )) {
    if (!mark.getAttribute("style")) {
      mark.setAttribute("style", "background-color: #fff3a3;");
    }
  }
}

function serializeSliceToMarkdown(editor: Editor, slice: Slice): string {
  const storage = editor.storage as MarkdownStorage;
  const markdown = storage.markdown?.serializer?.serialize(slice.content);
  if (markdown != null) return markdown;
  return slice.content.textBetween(0, slice.content.size, "\n\n");
}

function serializeSliceToHtml(
  editor: Editor,
  slice: Slice,
  ownerDocument: Document,
): string {
  const container = serializeSliceToHtmlContainer(editor, slice, ownerDocument);
  cleanClipboardHtml(container);
  return container.innerHTML;
}

function serializeSliceToHtmlContainer(
  editor: Editor,
  slice: Slice,
  ownerDocument: Document,
): HTMLElement {
  const container = ownerDocument.createElement("div");
  const serializer = DOMSerializer.fromSchema(editor.schema);
  container.appendChild(
    serializer.serializeFragment(slice.content, { document: ownerDocument }),
  );
  return container;
}

function normalizePlainTextWhitespace(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readNodePlainText(node: globalThis.Node): string {
  if (node.nodeType === globalThis.Node.TEXT_NODE) {
    return node.textContent ?? "";
  }

  if (!(node instanceof Element)) {
    return Array.from(node.childNodes).map(readNodePlainText).join("");
  }

  const tagName = node.tagName;
  if (tagName === "BR") return "\n";
  if (tagName === "HR") return "\n---\n";
  if (node instanceof HTMLImageElement) {
    return node.alt || node.getAttribute("src") || "";
  }

  if (tagName === "TR") {
    return `${Array.from(node.children)
      .map((child) => normalizePlainTextWhitespace(readNodePlainText(child)))
      .join("\t")}\n`;
  }

  const content = Array.from(node.childNodes).map(readNodePlainText).join("");
  if (tagName === "LI") {
    return `- ${normalizePlainTextWhitespace(content)}\n`;
  }

  if (BLOCK_TAG_NAMES.has(tagName)) {
    const text = normalizePlainTextWhitespace(content);
    return text ? `${text}\n\n` : "";
  }

  return content;
}

function serializeSliceToPlainText(
  editor: Editor,
  slice: Slice,
  ownerDocument: Document,
): string {
  const container = serializeSliceToHtmlContainer(editor, slice, ownerDocument);
  cleanClipboardHtml(container);
  return normalizePlainTextWhitespace(
    Array.from(container.childNodes).map(readNodePlainText).join(""),
  );
}

export function createStandardClipboardPayload(
  editor: Editor,
  slice: Slice,
  ownerDocument: Document = editor.view.dom.ownerDocument,
): StandardClipboardPayload {
  return {
    html: serializeSliceToHtml(editor, slice, ownerDocument),
    markdown: serializeSliceToMarkdown(editor, slice),
    plainText: serializeSliceToPlainText(editor, slice, ownerDocument),
  };
}

export function createClipboardMimeData(
  payload: StandardClipboardPayload,
  mode: EditorCopyMode = "standard",
): ClipboardMimeData {
  if (mode === "markdown") {
    return {
      "text/plain": payload.markdown,
      "text/markdown": payload.markdown,
      "text/x-markdown": payload.markdown,
    };
  }

  if (mode === "richText") {
    return {
      "text/plain": payload.plainText,
      "text/markdown": payload.markdown,
      "text/x-markdown": payload.markdown,
      "text/html": payload.html,
    };
  }

  if (mode === "plainText") {
    return {
      "text/plain": payload.plainText,
    };
  }

  return {
    "text/plain": payload.markdown,
    "text/markdown": payload.markdown,
    "text/x-markdown": payload.markdown,
    "text/html": payload.html,
  };
}

export function writeClipboardMimeData(
  clipboardData: DataTransfer,
  data: ClipboardMimeData,
): void {
  clipboardData.clearData();
  for (const [mimeType, value] of Object.entries(data)) {
    if (value != null) clipboardData.setData(mimeType, value);
  }
}

export function writeStandardClipboardPayload(
  clipboardData: DataTransfer,
  payload: StandardClipboardPayload,
  mode: EditorCopyMode = "standard",
): void {
  writeClipboardMimeData(clipboardData, createClipboardMimeData(payload, mode));
}

function writeClipboardMimeDataWithCopyEvent(
  ownerDocument: Document,
  data: ClipboardMimeData,
): boolean {
  let didWrite = false;
  const onCopy = (event: ClipboardEvent) => {
    if (!event.clipboardData) return;
    event.preventDefault();
    writeClipboardMimeData(event.clipboardData, data);
    didWrite = true;
  };

  ownerDocument.addEventListener("copy", onCopy, {
    capture: true,
    once: true,
  });

  let didCopy = false;
  try {
    didCopy = ownerDocument.execCommand("copy");
  } catch {
    didCopy = false;
  }
  if (!didWrite) {
    ownerDocument.removeEventListener("copy", onCopy, { capture: true });
  }

  return didCopy && didWrite;
}

async function writeClipboardMimeDataFallback(
  data: ClipboardMimeData,
): Promise<boolean> {
  const plainText = data["text/plain"];
  if (!plainText) return false;

  if (
    navigator.clipboard?.write &&
    typeof ClipboardItem !== "undefined" &&
    (data["text/html"] || plainText)
  ) {
    const itemData: Record<string, Blob> = {
      "text/plain": new Blob([plainText], { type: "text/plain" }),
    };
    if (data["text/html"]) {
      itemData["text/html"] = new Blob([data["text/html"]], {
        type: "text/html",
      });
    }

    try {
      await navigator.clipboard.write([new ClipboardItem(itemData)]);
      return true;
    } catch {
      // Fall through to writeText. Some WebViews reject HTML writes.
    }
  }

  if (!navigator.clipboard?.writeText) return false;
  await navigator.clipboard.writeText(plainText);
  return true;
}

export async function copyEditorSelection(
  editor: Editor,
  mode: EditorCopyMode = "standard",
): Promise<boolean> {
  if (editor.isDestroyed || editor.state.selection.empty) return false;

  const payload = createStandardClipboardPayload(
    editor,
    editor.state.selection.content(),
    editor.view.dom.ownerDocument,
  );
  const data = createClipboardMimeData(payload, mode);

  if (
    writeClipboardMimeDataWithCopyEvent(editor.view.dom.ownerDocument, data)
  ) {
    return true;
  }

  return writeClipboardMimeDataFallback(data);
}

function handleClipboardEvent(
  editor: Editor,
  view: EditorView,
  event: ClipboardEvent,
  shouldDeleteSelection: boolean,
): boolean {
  if (!event.clipboardData || view.state.selection.empty) return false;
  if (shouldUseNativeClipboard(event)) return false;

  const payload = createStandardClipboardPayload(
    editor,
    view.state.selection.content(),
    view.dom.ownerDocument,
  );

  event.preventDefault();
  writeStandardClipboardPayload(event.clipboardData, payload, "standard");

  if (shouldDeleteSelection && view.editable) {
    view.dispatch(view.state.tr.deleteSelection().scrollIntoView());
  }

  return true;
}

export const StandardClipboardCopy = Extension.create({
  name: "standardClipboardCopy",
  priority: 100,

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey("standardClipboardCopy"),
        props: {
          handleDOMEvents: {
            copy(view, event) {
              return handleClipboardEvent(
                editor,
                view,
                event as ClipboardEvent,
                false,
              );
            },
            cut(view, event) {
              return handleClipboardEvent(
                editor,
                view,
                event as ClipboardEvent,
                true,
              );
            },
          },
        },
      }),
    ];
  },
});
