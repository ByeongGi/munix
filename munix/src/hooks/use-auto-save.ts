import { useCallback, useEffect, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import type { Editor } from "@tiptap/react";
import { ipc } from "@/lib/ipc";
import { useEditorStore } from "@/store/editor-store";
import type { FlushOptions } from "@/store/editor-store";
import { useSettingsStore } from "@/store/settings-store";
import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { useTagStore } from "@/store/tag-store";
import { useBacklinkStore } from "@/store/backlink-store";
import { useSearchStore } from "@/store/search-store";
import { serializeDocument } from "@/lib/markdown";

interface MarkdownStorage {
  markdown: { getMarkdown: () => string };
}

export function useAutoSave(editor: Editor | null): {
  flush: (opts?: FlushOptions) => Promise<void>;
} {
  const setStatus = useEditorStore((s) => s.setStatus);
  const setBaseModified = useEditorStore((s) => s.setBaseModified);
  const setBody = useEditorStore((s) => s.setBody);
  const setFlushSave = useEditorStore((s) => s.setFlushSave);
  const setRequestSave = useEditorStore((s) => s.setRequestSave);
  const ws = useActiveWorkspaceStore();
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);

  const doSave = useCallback(
    async (opts?: FlushOptions) => {
      if (!editor || editor.isDestroyed) return;
      const { currentPath, currentTabId, baseModified, frontmatter } =
        useEditorStore.getState();
      if (!currentPath) return;

      if (inFlightRef.current) {
        pendingRef.current = true;
        return;
      }

      inFlightRef.current = true;
      setStatus({ kind: "saving", attempt: 1 });
      try {
        const body = (
          editor.storage as unknown as MarkdownStorage
        ).markdown.getMarkdown();
        const raw = serializeDocument({ frontmatter, body });
        const result = await ipc.writeFile(
          currentPath,
          raw,
          baseModified,
          opts?.force ?? false,
        );
        if (result.conflict) {
          // 충돌 시 디스크는 그대로, pending 플래시는 무효화
          pendingRef.current = false;
          setStatus({ kind: "conflict" });
          return;
        }
        setBaseModified(result.modified);
        setBody(body);
        setStatus({ kind: "saved", at: Date.now() });
        if (currentTabId) {
          ws.getState().upsertDocumentRuntime({
            tabId: currentTabId,
            path: currentPath,
            body,
            frontmatter,
            baseModified: result.modified,
            status: { kind: "saved", at: Date.now() },
            dirty: false,
            lastAccessedAt: Date.now(),
          });
        }
        // 자기 쓰기는 Rust watcher가 1500ms suppress 하므로 vault watcher 경유로는
        // 인덱스 업데이트가 영영 안 들어옴. 저장 직후 직접 갱신.
        void useTagStore.getState().updatePath(currentPath);
        void useBacklinkStore.getState().updatePath(currentPath);
        const search = useSearchStore.getState();
        if (search.status === "ready") {
          search.index.updateDoc(currentPath, body);
          if (search.query) search.setQuery(search.query);
        }
        setTimeout(() => {
          const now = useEditorStore.getState().status;
          if (now.kind === "saved") setStatus({ kind: "idle" });
        }, 1500);
      } catch (e) {
        setStatus({
          kind: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        inFlightRef.current = false;
        if (pendingRef.current) {
          pendingRef.current = false;
          void doSave();
        }
      }
    },
    [editor, setStatus, setBaseModified, setBody, ws],
  );

  const debounceMs = useSettingsStore((s) => s.autoSaveDebounceMs);

  const debouncedSave = useDebouncedCallback(() => {
    void doSave();
  }, debounceMs);

  useEffect(() => {
    if (!editor) return;

    const onUpdate = () => {
      const status = useEditorStore.getState().status;
      // 충돌 중에는 dirty/저장 재진입 금지 — 다이얼로그 처리 후 재개
      if (status.kind === "conflict") return;
      setStatus({ kind: "dirty", since: Date.now() });
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
  }, [editor, debouncedSave, setStatus]);

  const flush = useCallback(
    async (opts?: FlushOptions) => {
      if (opts?.force) {
        debouncedSave.cancel();
        await doSave({ force: true });
        return;
      }
      debouncedSave.flush();
      while (inFlightRef.current) {
        await new Promise((r) => setTimeout(r, 20));
      }
    },
    [debouncedSave, doSave],
  );

  useEffect(() => {
    setFlushSave(flush);
    return () => setFlushSave(null);
  }, [flush, setFlushSave]);

  useEffect(() => {
    const fn = () => {
      setStatus({ kind: "dirty", since: Date.now() });
      debouncedSave();
    };
    setRequestSave(fn);
    return () => setRequestSave(null);
  }, [debouncedSave, setRequestSave, setStatus]);

  return { flush };
}
