import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";

import { useActiveWorkspaceStore } from "@/lib/active-vault";
import { cn } from "@/lib/cn";

interface InactivePaneTitleInputProps {
  path: string;
  titleDraft?: string;
  onRename: (name: string) => Promise<boolean>;
  onSubmitTitle?: () => void;
}

export function InactivePaneTitleInput({
  path,
  titleDraft,
  onRename,
  onSubmitTitle,
}: InactivePaneTitleInputProps) {
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
      onChange={(event) => {
        const next = event.currentTarget.value;
        setValue(next);
        if (!isComposingRef.current) {
          setTitleDraft(path, next);
          requestRename(next, true);
        }
      }}
      onCompositionStart={() => {
        isComposingRef.current = true;
      }}
      onCompositionEnd={(event) => {
        isComposingRef.current = false;
        const next = event.currentTarget.value;
        setValue(next);
        setTitleDraft(path, next);
        requestRename(next, true);
      }}
      onBlur={(event) => {
        if (keepTitleFocusRef.current && !userLeavingTitleRef.current) {
          requestAnimationFrame(() => {
            inputRef.current?.focus({ preventScroll: true });
            isFocusedRef.current = true;
          });
          return;
        }
        isFocusedRef.current = false;
        keepTitleFocusRef.current = false;
        requestRename(event.currentTarget.value);
        userLeavingTitleRef.current = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          if (isComposingRef.current) return;
          event.preventDefault();
          userLeavingTitleRef.current = true;
          keepTitleFocusRef.current = false;
          requestRename(event.currentTarget.value);
          event.currentTarget.blur();
          onSubmitTitle?.();
        }
        if (event.key === "Tab") {
          userLeavingTitleRef.current = true;
          keepTitleFocusRef.current = false;
        }
        if (event.key === "Escape") {
          userLeavingTitleRef.current = true;
          keepTitleFocusRef.current = false;
          pendingRenameRef.current = null;
          setTitleDraft(path, null);
          setValue(baseName);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function basenameWithoutMd(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
}
