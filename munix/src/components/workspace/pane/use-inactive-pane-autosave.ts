import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
} from "react";
import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { useDebouncedCallback } from "use-debounce";
import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { ipc } from "@/lib/ipc";
import { serializeDocument } from "@/lib/markdown";
import { useSettingsStore } from "@/store/settings-store";
import {
  canRequestInactiveEditorSave,
  updateIndexesAfterInactiveSave,
} from "./inactive-pane-editor-utils";
import {
  type InactiveEditorStatus,
  type MarkdownStorage,
} from "./inactive-pane-editor-types";

interface UseInactivePaneAutosaveOptions {
  path: string;
  tabId: string;
  editor: Editor | null;
  statusRef: RefObject<InactiveEditorStatus>;
  frontmatterRef: RefObject<Record<string, unknown> | null>;
  baseModifiedRef: RefObject<number | null>;
  setBody: Dispatch<React.SetStateAction<string>>;
  setEditorJson: Dispatch<React.SetStateAction<JSONContent | null>>;
  setBaseModified: Dispatch<React.SetStateAction<number | null>>;
  setStatus: Dispatch<React.SetStateAction<InactiveEditorStatus>>;
}

export function useInactivePaneAutosave({
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
}: UseInactivePaneAutosaveOptions) {
  const ws = useActiveWorkspaceStore();
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);

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
      const editorJson = editor.getJSON();
      setBaseModified(result.modified);
      setBody(nextBody);
      setEditorJson(editorJson);
      setStatus("ready");
      ws.getState().upsertDocumentRuntime({
        tabId,
        path,
        body: nextBody,
        editorJson,
        frontmatter: frontmatterRef.current,
        baseModified: result.modified,
        status: { kind: "saved", at: Date.now() },
        dirty: false,
        lastAccessedAt: Date.now(),
      });
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
  }, [
    baseModifiedRef,
    editor,
    frontmatterRef,
    path,
    setBaseModified,
    setBody,
    setEditorJson,
    setStatus,
    statusRef,
    tabId,
    ws,
  ]);

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
    [debouncedSave, setStatus, statusRef],
  );

  const waitForIdleSave = useCallback(async () => {
    debouncedSave.flush();
    while (inFlightRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }, [debouncedSave]);

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
  }, [debouncedSave, editor, setStatus, statusRef]);

  return {
    requestSave,
    waitForIdleSave,
  };
}
