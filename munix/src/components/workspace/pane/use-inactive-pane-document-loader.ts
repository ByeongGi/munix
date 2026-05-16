import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import { useStore } from "zustand";
import { preprocessMarkdownCached } from "@/lib/editor-preprocess";
import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { ipc } from "@/lib/ipc";
import { parseDocument } from "@/lib/markdown";
import type { SaveStatus } from "@/store/editor-store";
import type { InactiveEditorStatus } from "./inactive-pane-editor-types";

function inactiveStatusFromSaveStatus(
  status: SaveStatus,
): InactiveEditorStatus {
  if (status.kind === "dirty") return "dirty";
  if (status.kind === "saving") return "saving";
  if (status.kind === "conflict") return "conflict";
  if (status.kind === "error") return "saveError";
  return "ready";
}

export function useInactivePaneDocumentLoader(path: string, tabId: string) {
  const ws = useActiveWorkspaceStore();
  const [body, setBody] = useState("");
  const [frontmatter, setFrontmatter] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [baseModified, setBaseModified] = useState<number | null>(null);
  const [editorJson, setEditorJson] = useState<JSONContent | null>(null);
  const [status, setStatus] = useState<InactiveEditorStatus>("loading");
  const statusRef = useRef<InactiveEditorStatus>("loading");
  const frontmatterRef = useRef<Record<string, unknown> | null>(null);
  const baseModifiedRef = useRef<number | null>(null);
  const externalModified = useStore(
    ws,
    (state) => state.documentRuntimes[tabId]?.externalModified === true,
  );
  const content = useMemo(
    () => editorJson ?? preprocessMarkdownCached(body),
    [body, editorJson],
  );

  const loadFromDisk = useCallback(
    async (isCancelled: () => boolean) => {
      setStatus("loading");
      setBaseModified(null);
      const file = await ipc.readFile(path);
      if (isCancelled()) return;
      const parsed = parseDocument(file.content);
      frontmatterRef.current = parsed.frontmatter;
      baseModifiedRef.current = file.modified;
      setBody(parsed.body);
      setEditorJson(null);
      setFrontmatter(parsed.frontmatter);
      setBaseModified(file.modified);
      setStatus("ready");
      ws.getState().upsertDocumentRuntime({
        tabId,
        path,
        body: parsed.body,
        frontmatter: parsed.frontmatter,
        baseModified: file.modified,
        status: { kind: "idle" },
        dirty: false,
        externalModified: false,
        lastAccessedAt: Date.now(),
      });
    },
    [path, tabId, ws],
  );

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
    const runtime = ws.getState().getDocumentRuntime(tabId);
    if (runtime && runtime.path === path && !runtime.externalModified) {
      frontmatterRef.current = runtime.frontmatter;
      baseModifiedRef.current = runtime.baseModified;
      setBody(runtime.body);
      setEditorJson(runtime.editorJson ?? null);
      setFrontmatter(runtime.frontmatter);
      setBaseModified(runtime.baseModified);
      setStatus(inactiveStatusFromSaveStatus(runtime.status));
      return () => {
        cancelled = true;
      };
    }

    void loadFromDisk(() => cancelled)
      .catch((e) => {
        if (cancelled) return;
        console.error("inactive pane editor failed", e);
        setBody("");
        setEditorJson(null);
        frontmatterRef.current = null;
        baseModifiedRef.current = null;
        setFrontmatter(null);
        setBaseModified(null);
        setStatus("loadError");
      });
    return () => {
      cancelled = true;
    };
  }, [loadFromDisk, path, tabId, ws]);

  useEffect(() => {
    if (!externalModified) return;

    if (statusRef.current !== "ready") {
      if (statusRef.current === "dirty" || statusRef.current === "saving") {
        setStatus("conflict");
      }
      return;
    }

    let cancelled = false;
    void loadFromDisk(() => cancelled).catch((e) => {
      if (cancelled) return;
      console.error("inactive pane editor reload failed", e);
      setStatus("loadError");
    });
    return () => {
      cancelled = true;
    };
  }, [externalModified, loadFromDisk]);

  return {
    body,
    setBody,
    editorJson,
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
  };
}
