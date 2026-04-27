import { useCallback, useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { useTranslation } from "react-i18next";

import { createEditorExtensions } from "@/components/editor/extensions";
import { cn } from "@/lib/cn";
import { InactivePanePropertiesPanel } from "./inactive-pane-properties-panel";
import { InactivePaneEditorStatusBanner } from "./inactive-pane-editor-status-banner";
import { InactivePaneTitleInput } from "./inactive-pane-title-input";
import { useInactivePaneAutosave } from "./use-inactive-pane-autosave";
import { useInactivePaneDocumentLoader } from "./use-inactive-pane-document-loader";
import { useInactivePaneRename } from "./use-inactive-pane-rename";
import {
  focusEditorEndOnEmptySurface,
  focusEditorStartOnNextFrame,
} from "@/components/editor/editor-focus";

interface InactivePaneEditorProps {
  path: string;
  titleDraft?: string;
}

export function InactivePaneEditor({
  path,
  titleDraft,
}: InactivePaneEditorProps) {
  const { t } = useTranslation(["editor", "app", "properties"]);
  const {
    setBody,
    content,
    frontmatter,
    setFrontmatter,
    setBaseModified,
    status,
    setStatus,
    statusRef,
    frontmatterRef,
    baseModifiedRef,
  } = useInactivePaneDocumentLoader(path);
  const editor = useEditor(
    {
      extensions: createEditorExtensions(t("editor:placeholder.document"), {
        hasFrontmatter: () => frontmatterRef.current !== null,
        onFrontmatterTrigger: () => {
          frontmatterRef.current = {};
          setFrontmatter({});
          requestSave(true);
        },
      }),
      content,
      editable: true,
      editorProps: {
        attributes: {
          class: cn(
            "tiptap prose",
            "min-h-full px-6 pt-4 pb-10 outline-none sm:px-8 lg:px-12",
            "prose-headings:font-semibold prose-headings:tracking-tight",
            "prose-p:my-2 prose-li:my-0",
            "prose-code:before:content-none prose-code:after:content-none",
            "prose-code:rounded prose-code:bg-[var(--color-bg-tertiary)] prose-code:px-1 prose-code:py-0.5",
            "prose-pre:bg-[var(--color-bg-tertiary)] prose-pre:border prose-pre:border-[var(--color-border-primary)]",
          ),
        },
      },
    },
    [t],
  );
  const { requestSave, waitForIdleSave } = useInactivePaneAutosave({
    path,
    editor,
    statusRef,
    frontmatterRef,
    baseModifiedRef,
    setBody,
    setBaseModified,
    setStatus,
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content]);

  const handleFrontmatterChange = useCallback(
    (next: Record<string, unknown> | null, flush: boolean) => {
      frontmatterRef.current = next;
      setFrontmatter(next);
      requestSave(flush);
    },
    [frontmatterRef, requestSave, setFrontmatter],
  );
  const handleEditorEmptyAreaMouseDown = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      focusEditorEndOnEmptySurface(editor, event);
    },
    [editor],
  );
  const focusEditorStart = useCallback(() => {
    focusEditorStartOnNextFrame(editor);
  }, [editor]);

  const handleRename = useInactivePaneRename({ path, waitForIdleSave });

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-[var(--color-text-tertiary)]">
        {t("app:pane.loadingEditor")}
      </div>
    );
  }

  if (status === "loadError") {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-[var(--color-danger)]">
        {t("app:pane.editorError")}
      </div>
    );
  }

  return (
    <div
      className="relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-[var(--color-bg-primary)]"
      onMouseDown={handleEditorEmptyAreaMouseDown}
    >
      <InactivePaneEditorStatusBanner status={status} />
      <InactivePaneTitleInput
        path={path}
        titleDraft={titleDraft}
        onRename={handleRename}
        onSubmitTitle={focusEditorStart}
      />
      <InactivePanePropertiesPanel
        frontmatter={frontmatter}
        onChange={handleFrontmatterChange}
      />
      <div className="munix-editor-content-surface">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
