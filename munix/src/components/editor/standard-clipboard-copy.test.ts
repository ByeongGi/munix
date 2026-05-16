import { Editor as TiptapEditor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { preprocessMarkdown } from "@/lib/editor-preprocess";
import { createEditorExtensions } from "./extensions";
import {
  MARKDOWN_CLIPBOARD_TYPES,
  createClipboardMimeData,
  createStandardClipboardPayload,
  writeStandardClipboardPayload,
} from "./standard-clipboard-copy";

class ClipboardDataStub {
  private readonly data = new Map<string, string>();

  clearData(format?: string): void {
    if (format) {
      this.data.delete(format);
      return;
    }
    this.data.clear();
  }

  getData(format: string): string {
    return this.data.get(format) ?? "";
  }

  setData(format: string, data: string): void {
    this.data.set(format, data);
  }
}

let editor: TiptapEditor | null = null;

function createTestEditor(markdown: string): TiptapEditor {
  editor = new TiptapEditor({
    extensions: createEditorExtensions(""),
    content: preprocessMarkdown(markdown),
    autofocus: false,
  });
  editor.commands.selectAll();
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("standard clipboard copy", () => {
  it("writes markdown MIME types and clean HTML from the editor model", () => {
    const testEditor = createTestEditor(
      [
        "# Heading",
        "",
        "Paragraph with **bold** text, [[Target|alias]], ==mark==, and $x^2$.",
      ].join("\n"),
    );

    const payload = createStandardClipboardPayload(
      testEditor,
      testEditor.state.selection.content(),
    );
    const clipboard = new ClipboardDataStub();

    writeStandardClipboardPayload(
      clipboard as unknown as DataTransfer,
      payload,
    );

    expect(clipboard.getData("text/plain")).toBe(payload.markdown);
    for (const mimeType of MARKDOWN_CLIPBOARD_TYPES) {
      expect(clipboard.getData(mimeType)).toBe(payload.markdown);
    }
    expect(clipboard.getData("text/html")).toBe(payload.html);

    expect(payload.markdown).toContain("# Heading");
    expect(payload.markdown).toContain("**bold**");
    expect(payload.markdown).toContain("[[Target|alias]]");
    expect(payload.markdown).toContain("==mark==");
    expect(payload.markdown).toContain("$x^2$");
    expect(payload.plainText).toContain("Paragraph with bold text");
    expect(payload.plainText).toContain("alias");
    expect(payload.plainText).not.toContain("[[Target|alias]]");
    expect(payload.plainText).not.toContain("==mark==");

    expect(payload.html).toContain("<h1>Heading</h1>");
    expect(payload.html).toContain("<strong>bold</strong>");
    expect(payload.html).toContain("<mark");
    expect(payload.html).toContain(">mark</mark>");
    expect(payload.html).toContain('<a href="Target">alias</a>');
    expect(payload.html).not.toContain("data-pm-slice");
    expect(payload.html).not.toContain("data-wikilink-target");
    expect(payload.html).not.toContain("contenteditable");
    expect(payload.html).not.toContain("munix-");
  });

  it("builds explicit clipboard mode payloads", () => {
    const testEditor = createTestEditor("Plain **bold** text");
    const payload = createStandardClipboardPayload(
      testEditor,
      testEditor.state.selection.content(),
    );

    expect(createClipboardMimeData(payload, "standard")).toEqual({
      "text/plain": payload.markdown,
      "text/markdown": payload.markdown,
      "text/x-markdown": payload.markdown,
      "text/html": payload.html,
    });
    expect(createClipboardMimeData(payload, "markdown")).toEqual({
      "text/plain": payload.markdown,
      "text/markdown": payload.markdown,
      "text/x-markdown": payload.markdown,
    });
    expect(createClipboardMimeData(payload, "richText")).toEqual({
      "text/plain": payload.plainText,
      "text/markdown": payload.markdown,
      "text/x-markdown": payload.markdown,
      "text/html": payload.html,
    });
    expect(createClipboardMimeData(payload, "plainText")).toEqual({
      "text/plain": payload.plainText,
    });
  });

  it("does not copy node view controls around code blocks", () => {
    const testEditor = createTestEditor(
      ["```ts", "const answer = 42;", "```"].join("\n"),
    );

    const payload = createStandardClipboardPayload(
      testEditor,
      testEditor.state.selection.content(),
    );

    expect(payload.markdown).toContain("const answer = 42;");
    expect(payload.html).toContain("const answer = 42;");
    expect(payload.html).not.toContain("<button");
    expect(payload.html).not.toContain("<select");
    expect(payload.html).not.toContain("Preview");
  });
});
