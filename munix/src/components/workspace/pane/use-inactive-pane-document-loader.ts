import { useEffect, useMemo, useRef, useState } from "react";
import { preprocessMarkdown } from "@/lib/editor-preprocess";
import { ipc } from "@/lib/ipc";
import { parseDocument } from "@/lib/markdown";
import type { InactiveEditorStatus } from "./inactive-pane-editor-types";

export function useInactivePaneDocumentLoader(path: string) {
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
