export type EditorCopyMode = "standard" | "markdown" | "richText" | "plainText";

export type CopySelectionFn = (mode?: EditorCopyMode) => Promise<boolean>;
