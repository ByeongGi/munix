import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { useDebouncedCallback } from "use-debounce";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Plus, X } from "lucide-react";

import { createEditorExtensions } from "@/components/editor/extensions";
import { PropertyRow } from "@/components/editor/properties/property-row";
import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { preprocessMarkdown } from "@/lib/editor-preprocess";
import { ipc } from "@/lib/ipc";
import { parseDocument, serializeDocument } from "@/lib/markdown";
import { cn } from "@/lib/cn";
import { useBacklinkStore } from "@/store/backlink-store";
import { usePropertyTypesStore } from "@/store/property-types-store";
import { useSearchStore } from "@/store/search-store";
import { useSettingsStore } from "@/store/settings-store";
import { useTagStore } from "@/store/tag-store";
import { KNOWN_PROPERTY_TYPES, type PropertyType } from "@/types/frontmatter";

interface InactivePaneEditorProps {
  path: string;
  titleDraft?: string;
}

interface MarkdownStorage {
  markdown: { getMarkdown: () => string };
}

function defaultValueForPropertyType(type: PropertyType): unknown {
  switch (type) {
    case "number":
      return null;
    case "checkbox":
      return false;
    case "multitext":
    case "tags":
    case "aliases":
      return [];
    case "date":
    case "datetime":
    case "text":
      return "";
  }
}

type InactiveEditorStatus =
  | "loading"
  | "ready"
  | "dirty"
  | "saving"
  | "loadError"
  | "saveError"
  | "conflict";

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
    if (
      statusRef.current === "conflict" ||
      statusRef.current === "loading" ||
      statusRef.current === "loadError"
    ) {
      return;
    }

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

      void useTagStore.getState().updatePath(path);
      void useBacklinkStore.getState().updatePath(path);
      const search = useSearchStore.getState();
      if (search.status === "ready") {
        search.index.updateDoc(path, nextBody);
        if (search.query) search.setQuery(search.query);
      }
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
      if (
        statusRef.current === "conflict" ||
        statusRef.current === "loading" ||
        statusRef.current === "loadError"
      ) {
        return;
      }
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
      if (
        statusRef.current === "conflict" ||
        statusRef.current === "loading" ||
        statusRef.current === "loadError"
      ) {
        return;
      }
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
      {(status === "conflict" || status === "saveError") && (
        <div className="sticky top-0 z-10 border-b border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-3 py-2 text-xs text-[var(--color-danger)]">
          {status === "conflict"
            ? t("app:pane.editorConflict")
            : t("app:pane.editorSaveError")}
        </div>
      )}
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

function InactivePaneTitleInput({
  path,
  titleDraft,
  onRename,
}: {
  path: string;
  titleDraft?: string;
  onRename: (name: string) => Promise<boolean>;
}) {
  const { t } = useTranslation(["editor"]);
  const ws = useActiveWorkspaceStore();
  const setTitleDraft = useStore(ws, (s) => s.setTitleDraft);
  const baseName = basenameWithoutMd(path);
  const displayName = titleDraft ?? baseName;
  const [value, setValue] = useState(displayName);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isFocusedRef = useRef(false);
  const isComposingRef = useRef(false);
  const keepTitleFocusRef = useRef(false);
  const userLeavingTitleRef = useRef(false);
  const baseNameRef = useRef(baseName);
  const pathRef = useRef(path);
  const onRenameRef = useRef(onRename);
  const pendingRenameRef = useRef<string | null>(null);
  const renameInFlightRef = useRef(false);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      userLeavingTitleRef.current =
        event.target instanceof Node &&
        !!inputRef.current &&
        !inputRef.current.contains(event.target);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  useEffect(() => {
    if (keepTitleFocusRef.current && !userLeavingTitleRef.current) {
      requestAnimationFrame(() => {
        inputRef.current?.focus({ preventScroll: true });
        isFocusedRef.current = true;
        keepTitleFocusRef.current = false;
      });
    }
    if (!isFocusedRef.current) {
      setValue(displayName);
    }
  }, [baseName, displayName]);

  useEffect(() => {
    baseNameRef.current = baseName;
  }, [baseName]);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  useEffect(() => {
    onRenameRef.current = onRename;
  }, [onRename]);

  const drainRenameQueue = () => {
    if (renameInFlightRef.current) return;
    renameInFlightRef.current = true;

    void (async () => {
      try {
        while (pendingRenameRef.current !== null) {
          const next = pendingRenameRef.current.trim();
          pendingRenameRef.current = null;

          if (!next || next === baseNameRef.current) continue;
          const ok = await onRenameRef.current(next);
          if (!ok) {
            setTitleDraft(pathRef.current, null);
            setValue(baseNameRef.current);
            pendingRenameRef.current = null;
            break;
          }
        }
      } finally {
        renameInFlightRef.current = false;
        if (pendingRenameRef.current !== null) {
          drainRenameQueue();
        }
      }
    })();
  };

  const requestRename = (name: string, preserveFocus = false) => {
    if (preserveFocus) {
      keepTitleFocusRef.current = true;
    }
    pendingRenameRef.current = name;
    drainRenameQueue();
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      placeholder={t("editor:placeholder.title", { defaultValue: "Untitled" })}
      className={cn(
        "w-full bg-transparent px-12 pt-8 pb-2 outline-none",
        "text-3xl font-semibold text-[var(--color-text-primary)]",
        "placeholder:text-[var(--color-text-tertiary)]",
      )}
      onFocus={() => {
        isFocusedRef.current = true;
        userLeavingTitleRef.current = false;
      }}
      onChange={(e) => {
        const next = e.currentTarget.value;
        setValue(next);
        if (!isComposingRef.current) {
          setTitleDraft(path, next);
          requestRename(next, true);
        }
      }}
      onCompositionStart={() => {
        isComposingRef.current = true;
      }}
      onCompositionEnd={(e) => {
        isComposingRef.current = false;
        const next = e.currentTarget.value;
        setValue(next);
        setTitleDraft(path, next);
        requestRename(next, true);
      }}
      onBlur={(e) => {
        if (keepTitleFocusRef.current && !userLeavingTitleRef.current) {
          requestAnimationFrame(() => {
            inputRef.current?.focus({ preventScroll: true });
            isFocusedRef.current = true;
          });
          return;
        }
        isFocusedRef.current = false;
        keepTitleFocusRef.current = false;
        requestRename(e.currentTarget.value);
        userLeavingTitleRef.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const next = e.currentTarget.value.trim();
          keepTitleFocusRef.current = !!next && next !== baseNameRef.current;
          requestRename(e.currentTarget.value, true);
          requestAnimationFrame(() => {
            inputRef.current?.focus({ preventScroll: true });
            isFocusedRef.current = true;
          });
        }
        if (e.key === "Tab") {
          userLeavingTitleRef.current = true;
          keepTitleFocusRef.current = false;
        }
        if (e.key === "Escape") {
          userLeavingTitleRef.current = true;
          keepTitleFocusRef.current = false;
          pendingRenameRef.current = null;
          setTitleDraft(path, null);
          setValue(baseName);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function InactivePanePropertiesPanel({
  frontmatter,
  onChange,
}: {
  frontmatter: Record<string, unknown> | null;
  onChange: (
    frontmatter: Record<string, unknown> | null,
    flush: boolean,
  ) => void;
}) {
  const { t } = useTranslation(["properties"]);
  const resolve = usePropertyTypesStore((s) => s.resolve);
  const setType = usePropertyTypesStore((s) => s.setType);
  const [adding, setAdding] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [draftKey, setDraftKey] = useState("");
  const [draftType, setDraftType] = useState<PropertyType>("text");
  const entries = useMemo(
    () => Object.entries(frontmatter ?? {}) as [string, unknown][],
    [frontmatter],
  );

  const fm = (frontmatter ?? {}) as Record<string, unknown>;

  const handleValueChange = (key: string, raw: unknown, flush: boolean) => {
    onChange({ ...fm, [key]: raw }, flush);
  };

  const handleDelete = (key: string) => {
    const next = { ...fm };
    delete next[key];
    onChange(Object.keys(next).length === 0 ? null : next, true);
  };

  const handleAdd = () => {
    const key = draftKey.trim();
    if (!key || key in fm) {
      setDraftKey("");
      setDraftType("text");
      setAdding(false);
      setTypeMenuOpen(false);
      return;
    }
    onChange({ ...fm, [key]: defaultValueForPropertyType(draftType) }, true);
    void setType(key, draftType);
    setDraftKey("");
    setDraftType("text");
    setAdding(false);
    setTypeMenuOpen(false);
  };

  const handleDeletePanel = () => {
    onChange(null, true);
  };

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const isField =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable;
    if (isField) return;
    if (entries.length > 0) return;
    if (event.key !== "Backspace" && event.key !== "Delete") return;

    event.preventDefault();
    handleDeletePanel();
  };

  if (frontmatter === null) return null;

  return (
    <div
      className={cn(
        "mx-12 mt-3 mb-1 rounded-md border",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-primary)]",
      )}
      tabIndex={0}
      onKeyDown={handlePanelKeyDown}
    >
      <div className="flex h-7 items-center gap-2 border-b border-[var(--color-border-primary)] px-2.5">
        <span
          className={cn(
            "text-[11px] font-medium",
            "text-[var(--color-text-secondary)]",
          )}
        >
          {t("properties:heading")}
        </span>
        <span className="text-[10px] text-[var(--color-text-tertiary)]">
          {entries.length}
        </span>
        <button
          type="button"
          onClick={handleDeletePanel}
          className={cn(
            "ml-auto rounded p-0.5",
            "text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-secondary)]",
          )}
          aria-label={t("properties:deletePanel")}
          title={t("properties:deletePanel")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {entries.length > 0 && (
        <div className="px-1.5 py-1">
          {entries.map(([key, value]) => (
            <PropertyRow
              key={key}
              fieldKey={key}
              value={value}
              type={resolve(key, value)}
              onValueChange={(raw, flush) => handleValueChange(key, raw, flush)}
              onDelete={() => handleDelete(key)}
              onTypeChange={(type: PropertyType) => {
                void setType(key, type);
              }}
            />
          ))}
        </div>
      )}
      <div
        className={cn(
          entries.length > 0
            ? "border-t border-[var(--color-border-primary)] px-1.5 py-1"
            : "px-1.5 py-1",
        )}
      >
        {!adding ? (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setTypeMenuOpen(true);
            }}
            className={cn(
              "flex h-7 w-full items-center gap-1.5 rounded px-1.5 text-xs",
              "border border-dashed border-[var(--color-border-secondary)]",
              "text-[var(--color-text-tertiary)] hover:border-[var(--color-border-primary)] hover:bg-[var(--color-bg-hover)]",
              "hover:text-[var(--color-text-secondary)]",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("properties:add")}
          </button>
        ) : (
          <div className="relative flex h-7 items-center gap-1.5 px-1.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setTypeMenuOpen((v) => !v)}
              className={cn(
                "rounded border border-[var(--color-border-secondary)] px-1.5 py-0.5 text-[11px]",
                "text-[var(--color-text-tertiary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-secondary)]",
              )}
            >
              {t(`properties:types.${draftType}`, { defaultValue: draftType })}
            </button>
            {typeMenuOpen && (
              <InactivePropertyTypeMenu
                current={draftType}
                onSelect={(next) => {
                  setDraftType(next);
                  setTypeMenuOpen(false);
                }}
              />
            )}
            <input
              autoFocus
              type="text"
              value={draftKey}
              onChange={(e) => setDraftKey(e.currentTarget.value)}
              onBlur={handleAdd}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setDraftKey("");
                  setAdding(false);
                  setTypeMenuOpen(false);
                }
              }}
              placeholder={t("properties:placeholder.newKey")}
              className={cn(
                "h-6 flex-1 rounded border px-1.5 text-xs outline-none",
                "border-[var(--color-accent)] bg-[var(--color-bg-tertiary)]",
                "focus:border-[var(--color-accent)]",
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function InactivePropertyTypeMenu({
  current,
  onSelect,
}: {
  current: PropertyType;
  onSelect: (type: PropertyType) => void;
}) {
  const { t } = useTranslation(["properties"]);

  return (
    <div
      className={cn(
        "absolute left-1.5 top-7 z-50 w-36 rounded-md border p-1 shadow-lg",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]",
      )}
    >
      {KNOWN_PROPERTY_TYPES.map((item) => (
        <button
          key={item}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(item)}
          className={cn(
            "flex h-7 w-full items-center rounded px-2 text-left text-xs",
            current === item
              ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
          )}
        >
          {t(`properties:types.${item}`, { defaultValue: item })}
        </button>
      ))}
    </div>
  );
}
