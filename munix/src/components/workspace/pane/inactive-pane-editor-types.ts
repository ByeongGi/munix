export interface MarkdownStorage {
  markdown: { getMarkdown: () => string };
}

export type InactiveEditorStatus =
  | "loading"
  | "ready"
  | "dirty"
  | "saving"
  | "loadError"
  | "saveError"
  | "conflict";
