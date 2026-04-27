import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { useDebouncedCallback } from "use-debounce";
import { useTranslation } from "react-i18next";

import { createEditorExtensions } from "@/components/editor/extensions";
import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { preprocessMarkdown } from "@/lib/editor-preprocess";
import { ipc } from "@/lib/ipc";
import { parseDocument, serializeDocument } from "@/lib/markdown";
import { cn } from "@/lib/cn";
import { useBacklinkStore } from "@/store/backlink-store";
import { useSearchStore } from "@/store/search-store";
import { useSettingsStore } from "@/store/settings-store";
import { useTagStore } from "@/store/tag-store";
import { InactivePanePropertiesPanel } from "./inactive-pane-properties-panel";
import { InactivePaneTitleInput } from "./inactive-pane-title-input";

interface InactivePaneEditorProps {
  path: string;
  titleDraft?: string;
}

interface MarkdownStorage {
  markdown: { getMarkdown: () => string };
}

type InactiveEditorStatus =
  | "loading"
  | "ready"
  | "dirty"
  | "saving"
  | "loadError"
  | "saveError"
  | "conflict";

function canRequestInactiveEditorSave(status: InactiveEditorStatus): boolean {
  return status !== "conflict" && status !== "loading" && status !== "loadError";
}

function updateIndexesAfterInactiveSave(path: string, body: string) {
  void useTagStore.getState().updatePath(path);
  void useBacklinkStore.getState().updatePath(path);
  const search = useSearchStore.getState();
  if (search.status === "ready") {
    search.index.updateDoc(path, body);
    if (search.query) search.setQuery(search.query);
  }
}

export function InactivePaneEditor({
  path,
  titleDraft,
}: InactivePaneEditorProps) {
  const { t } = useTranslation(["editor", "app", "properties"]);
  const ws = useActiveWorkspaceStore();
  const [body, setBody] = useState("");
  const [frontmatter, setFrontmatter] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [baseModified, setBaseModified] = useState<number | null>(null);
  const [status, setStatus] = useState<InactiveEditorStatus>("loading");
  const statusRef = useRef<InactiveEditorStatus>("loading");
  const frontmatterRef = useRef<Record<string, unknown> | null>(null);
  const baseModifiedRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    frontmatterRef.current = frontmatter;
  }, [frontmatter]);

  useEffect(() => {
    baseModifiedRef.current = baseModified;
  }, [baseModified]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setBaseModified(null);
    void ipc
      .readFile(path)
      .then((file) => {
        if (cancelled) return;
        const parsed = parseDocument(file.content);
        frontmatterRef.current = parsed.frontmatter;
        baseModifiedRef.current = file.modified;
        setBody(parsed.body);
        setFrontmatter(parsed.frontmatter);
        setBaseModified(file.modified);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("inactive pane editor failed", e);
        setBody("");
        frontmatterRef.current = null;
        baseModifiedRef.current = null;
        setFrontmatter(null);
        setBaseModified(null);
        setStatus("loadError");
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  const content = useMemo(() => preprocessMarkdown(body), [body]);
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
            "tiptap prose max-w-none",
            "min-h-full px-12 pt-4 pb-10 outline-none",
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

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content]);

  const doSave = useCallback(async () => {
    const expectedModified = baseModifiedRef.current;
    if (!editor || editor.isDestroyed || expectedModified == null) return;
    if (!canRequestInactiveEditorSave(statusRef.current)) return;

    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }

    inFlightRef.current = true;
    setStatus("saving");
    try {
      const nextBody = (
        editor.storage as unknown as MarkdownStorage
      ).markdown.getMarkdown();
      const raw = serializeDocument({
        frontmatter: frontmatterRef.current,
        body: nextBody,
      });
      const result = await ipc.writeFile(path, raw, expectedModified, false);
      if (result.conflict) {
        pendingRef.current = false;
        setStatus("conflict");
        return;
      }
      baseModifiedRef.current = result.modified;
      setBaseModified(result.modified);
      setBody(nextBody);
      setStatus("ready");
      updateIndexesAfterInactiveSave(path, nextBody);
    } catch (e) {
      console.error("inactive pane editor save failed", e);
      setStatus("saveError");
    } finally {
      inFlightRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void doSave();
      }
    }
  }, [editor, path]);

  const debounceMs = useSettingsStore((s) => s.autoSaveDebounceMs);
  const debouncedSave = useDebouncedCallback(() => {
    void doSave();
  }, debounceMs);

  const requestSave = useCallback(
    (flush = false) => {
      if (!canRequestInactiveEditorSave(statusRef.current)) return;
      setStatus("dirty");
      debouncedSave();
      if (flush) debouncedSave.flush();
    },
    [debouncedSave],
  );

  const waitForIdleSave = useCallback(async () => {
    debouncedSave.flush();
    while (inFlightRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }, [debouncedSave]);

  const handleFrontmatterChange = useCallback(
    (next: Record<string, unknown> | null, flush: boolean) => {
      frontmatterRef.current = next;
      setFrontmatter(next);
      requestSave(flush);
    },
    [requestSave],
  );

  const handleRename = useCallback(
    async (name: string): Promise<boolean> => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      if (/[/\\:*?"<>|]/.test(trimmed) || trimmed.startsWith(".")) {
        return false;
      }

      const currentBase = basenameWithoutMd(path);
      if (trimmed === currentBase) return true;

      await waitForIdleSave();
      const lastSlash = path.lastIndexOf("/");
      const dir = lastSlash >= 0 ? path.substring(0, lastSlash) : "";
      const newPath = dir ? `${dir}/${trimmed}.md` : `${trimmed}.md`;

      try {
        await ipc.renameEntry(path, newPath);
        useSearchStore.getState().renamePath?.(path, newPath);
        useTagStore.getState().renamePath?.(path, newPath);
        useBacklinkStore.getState().renamePath?.(path, newPath);

        const state = ws.getState();
        state.updatePathInAllPanes(path, newPath);
        if (state.currentPath === path) {
          await state.openFile(newPath);
        }
        const { useVaultStore } = await import("@/store/vault-store");
        void useVaultStore.getState().refresh();
        return true;
      } catch (e) {
        console.error("inactive pane rename failed", e);
        return false;
      }
    },
    [path, waitForIdleSave, ws],
  );

  useEffect(() => {
    if (!editor) return;

    const onUpdate = () => {
      if (!canRequestInactiveEditorSave(statusRef.current)) return;
      setStatus("dirty");
      debouncedSave();
    };
    const onBlur = () => {
      debouncedSave.flush();
    };

    editor.on("update", onUpdate);
    editor.on("blur", onBlur);

    return () => {
      editor.off("update", onUpdate);
      editor.off("blur", onBlur);
      debouncedSave.flush();
    };
  }, [debouncedSave, editor]);

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
    <div className="relative min-h-0 flex-1 overflow-y-auto bg-[var(--color-bg-primary)]">
      <InactivePaneEditorStatusBanner status={status} />
      <InactivePaneTitleInput
        path={path}
        titleDraft={titleDraft}
        onRename={handleRename}
      />
      <InactivePanePropertiesPanel
        frontmatter={frontmatter}
        onChange={handleFrontmatterChange}
      />
      <EditorContent editor={editor} />
    </div>
  );
}

function basenameWithoutMd(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}

function InactivePaneEditorStatusBanner({
  status,
}: {
  status: InactiveEditorStatus;
}) {
  const { t } = useTranslation(["app"]);
  if (status !== "conflict" && status !== "saveError") return null;

  return (
    <div className="sticky top-0 z-10 border-b border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-3 py-2 text-xs text-[var(--color-danger)]">
      {status === "conflict"
        ? t("app:pane.editorConflict")
        : t("app:pane.editorSaveError")}
    </div>
  );
}
