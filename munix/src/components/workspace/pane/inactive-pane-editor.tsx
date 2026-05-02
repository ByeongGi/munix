import { useCallback, useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { useTranslation } from "react-i18next";

import { createEditorExtensions } from "@/components/editor/extensions";
import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { cn } from "@/lib/cn";
import type {
  DocumentRuntime,
  ScrollRuntimeState,
} from "@/store/slices/document-runtime-slice";
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
  tabId: string;
  path: string;
  titleDraft?: string;
}

function captureInactiveScroll(
  scrollEl: HTMLDivElement | null,
): ScrollRuntimeState | undefined {
  if (!scrollEl) return undefined;
  return { top: scrollEl.scrollTop };
}

export function InactivePaneEditor({
  tabId,
  path,
  titleDraft,
}: InactivePaneEditorProps) {
  const { t } = useTranslation(["editor", "app", "properties"]);
  const ws = useActiveWorkspaceStore();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const appliedDocumentRef = useRef<{
    tabId: string;
    path: string;
    body: string;
  } | null>(null);
  const {
    body,
    setBody,
    setEditorJson,
    content,
    frontmatter,
    setFrontmatter,
    setBaseModified,
    status,
    setStatus,
    statusRef,
    frontmatterRef,
    baseModifiedRef,
  } = useInactivePaneDocumentLoader(path, tabId);
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
            "min-h-full px-16 pt-4 pb-10 outline-none sm:px-20 lg:px-24",
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
    tabId,
    editor,
    statusRef,
    frontmatterRef,
    baseModifiedRef,
    setBody,
    setEditorJson,
    setBaseModified,
    setStatus,
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const storage = editor.storage as unknown as {
      markdown: { getMarkdown: () => string };
    };
    const appliedDocument = appliedDocumentRef.current;
    if (
      appliedDocument?.tabId === tabId &&
      appliedDocument.path === path &&
      storage.markdown.getMarkdown() === body
    ) {
      appliedDocumentRef.current = { tabId, path, body };
      return;
    }

    editor.commands.setContent(content, { emitUpdate: false });
    appliedDocumentRef.current = { tabId, path, body };
    const runtime = ws.getState().getDocumentRuntime(tabId);
    if (runtime?.selection) {
      const max = Math.max(1, editor.state.doc.content.size - 1);
      const from = Math.max(1, Math.min(runtime.selection.from, max));
      const to = Math.max(from, Math.min(runtime.selection.to, max));
      editor.commands.setTextSelection({ from, to });
    }
    if (runtime?.scroll && scrollRef.current) {
      scrollRef.current.scrollTop = runtime.scroll.top;
    }
  }, [body, content, editor, path, tabId, ws]);

  const captureRuntime = useCallback((): DocumentRuntime | null => {
    if (!editor || editor.isDestroyed) return null;
    const storage = editor.storage as unknown as {
      markdown: { getMarkdown: () => string };
    };
    const nextBody = storage.markdown.getMarkdown();
    const saveStatus =
      statusRef.current === "dirty"
        ? ({ kind: "dirty", since: Date.now() } as const)
        : statusRef.current === "saving"
          ? ({ kind: "saving", attempt: 1 } as const)
          : statusRef.current === "conflict"
            ? ({ kind: "conflict" } as const)
            : statusRef.current === "saveError"
              ? ({ kind: "error", error: "inactive pane save failed" } as const)
              : ({ kind: "idle" } as const);
    return {
      tabId,
      path,
      body: nextBody,
      editorJson: editor.getJSON(),
      frontmatter: frontmatterRef.current,
      baseModified: baseModifiedRef.current,
      status: saveStatus,
      selection: {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      },
      scroll: captureInactiveScroll(scrollRef.current),
      dirty: saveStatus.kind === "dirty" || saveStatus.kind === "conflict",
      lastAccessedAt: Date.now(),
    };
  }, [baseModifiedRef, editor, frontmatterRef, path, statusRef, tabId]);

  useEffect(() => {
    return () => {
      const runtime = captureRuntime();
      if (runtime) ws.getState().upsertDocumentRuntime(runtime);
    };
  }, [captureRuntime, ws]);

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
      ref={scrollRef}
      className="relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-[var(--color-editor-bg)]"
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
