import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { useEditorStore } from "@/store/editor-store";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { useActiveWorkspaceStore } from "@/lib/active-vault";

interface EditorTitleInputProps {
  className?: string;
  onSubmitTitle?: () => void;
}

/** 제목 = 파일명. Obsidian 동작 매칭 (ADR-029):
 * - 타이핑 중에는 tab titleDraft만 즉시 업데이트한다.
 * - 실제 파일 rename도 즉시 실행하되 editor lifecycle은 path 변경과 분리한다.
 * - Escape → 직전 값으로 revert
 * - 외부 rename (watcher) → 포커스 안일 때만 입력란 동기화
 */
export function EditorTitleInput({
  className,
  onSubmitTitle,
}: EditorTitleInputProps) {
  const { t } = useTranslation(["editor"]);
  const ws = useActiveWorkspaceStore();
  const currentPath = useEditorStore((s) => s.currentPath);
  const renameCurrent = useEditorStore((s) => s.renameCurrent);
  const titleDraft = useStore(ws, (s) =>
    currentPath
      ? s.tabs.find((tab) => tab.path === currentPath)?.titleDraft
      : undefined,
  );
  const setTitleDraft = useStore(ws, (s) => s.setTitleDraft);

  // currentPath에서 파일명(.md 제거) 추출
  const baseName = currentPath
    ? (currentPath.split("/").pop() ?? currentPath).replace(/\.md$/i, "")
    : "";

  const displayName = titleDraft ?? baseName;
  const [value, setValue] = useState(displayName);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isFocusedRef = useRef(false);
  const isComposingRef = useRef(false);
  const keepTitleFocusRef = useRef(false);
  const userLeavingTitleRef = useRef(false);
  const baseNameRef = useRef(baseName);
  const currentPathRef = useRef(currentPath);
  const renameCurrentRef = useRef(renameCurrent);
  const pendingRenameRef = useRef<string | null>(null);
  const renameInFlightRef = useRef(false);

  useEffect(() => {
    baseNameRef.current = baseName;
  }, [baseName]);

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  useEffect(() => {
    renameCurrentRef.current = renameCurrent;
  }, [renameCurrent]);

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

  // 외부(watcher) rename 반영 — 포커스 중에는 덮어쓰지 않음
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

  if (!currentPath) return null;

  const drainRenameQueue = () => {
    if (renameInFlightRef.current) return;
    renameInFlightRef.current = true;

    void (async () => {
      try {
        while (pendingRenameRef.current !== null) {
          const next = pendingRenameRef.current.trim();
          pendingRenameRef.current = null;

          if (!next || next === baseNameRef.current) continue;
          const result = await renameCurrentRef.current(next);
          if (!result.ok) {
            const path = currentPathRef.current;
            if (path) setTitleDraft(path, null);
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
        "w-full bg-transparent outline-none",
        "text-3xl font-semibold text-[var(--color-text-primary)]",
        "px-12 pt-8 pb-2",
        "placeholder:text-[var(--color-text-tertiary)]",
        className,
      )}
      onFocus={() => {
        isFocusedRef.current = true;
        userLeavingTitleRef.current = false;
      }}
      onChange={(e) => {
        const next = e.currentTarget.value;
        setValue(next);
        if (!isComposingRef.current) {
          setTitleDraft(currentPath, next);
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
        setTitleDraft(currentPath, next);
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
          if (isComposingRef.current) return;
          e.preventDefault();
          userLeavingTitleRef.current = true;
          keepTitleFocusRef.current = false;
          requestRename(e.currentTarget.value);
          e.currentTarget.blur();
          onSubmitTitle?.();
        }
        if (e.key === "Tab") {
          userLeavingTitleRef.current = true;
          keepTitleFocusRef.current = false;
        }
        if (e.key === "Escape") {
          userLeavingTitleRef.current = true;
          keepTitleFocusRef.current = false;
          pendingRenameRef.current = null;
          setTitleDraft(currentPath, null);
          setValue(baseName);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
