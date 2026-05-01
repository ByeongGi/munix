import { useEffect, useMemo, useRef, useState } from "react";
import { preprocessMarkdown } from "@/lib/editor-preprocess";
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
  const [status, setStatus] = useState<InactiveEditorStatus>("loading");
  const statusRef = useRef<InactiveEditorStatus>("loading");
  const frontmatterRef = useRef<Record<string, unknown> | null>(null);
  const baseModifiedRef = useRef<number | null>(null);
  const content = useMemo(() => preprocessMarkdown(body), [body]);

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
      setFrontmatter(runtime.frontmatter);
      setBaseModified(runtime.baseModified);
      setStatus(inactiveStatusFromSaveStatus(runtime.status));
      return () => {
        cancelled = true;
      };
    }

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
        ws.getState().upsertDocumentRuntime({
          tabId,
          path,
          body: parsed.body,
          frontmatter: parsed.frontmatter,
          baseModified: file.modified,
          status: { kind: "idle" },
          dirty: false,
          lastAccessedAt: Date.now(),
        });
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
  }, [path, tabId, ws]);

  return {
    body,
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
  };
}
