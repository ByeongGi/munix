import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ChevronUp, ChevronDown, X, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { searchKey, type SearchState } from "./search-highlight";

interface SearchBarProps {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
}

export function SearchBar({ editor, open, onClose }: SearchBarProps) {
  const { t } = useTranslation(["editor"]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<{
    total: number;
    index: number;
  }>({ total: 0, index: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editor || !open) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editor, open]);

  useEffect(() => {
    if (!editor) return;
    const syncState = () => {
      const s = searchKey.getState(editor.state) as SearchState | undefined;
      if (!s) return;
      setState({ total: s.matches.length, index: s.currentIndex });
    };
    editor.on("transaction", syncState);
    syncState();
    return () => {
      editor.off("transaction", syncState);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    if (open) {
      editor.commands.setSearchQuery(query);
    } else {
      editor.commands.clearSearch();
    }
  }, [editor, query, open]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!editor) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) editor.commands.prevSearchMatch();
      else editor.commands.nextSearchMatch();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className={cn(
        "absolute right-4 top-3 z-40 flex items-center gap-1 rounded-md border p-1 shadow-lg",
        "border-[var(--color-border-primary)] bg-[var(--color-bg-secondary-solid)]",
      )}
    >
      <Search className="ml-1 h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("editor:searchBar.placeholder")}
        className={cn(
          "w-48 bg-transparent px-1 py-1 text-sm outline-none",
          "placeholder:text-[var(--color-text-tertiary)]",
        )}
      />
      <span className="min-w-[48px] text-right text-xs text-[var(--color-text-tertiary)]">
        {state.total === 0
          ? query
            ? "0/0"
            : ""
          : `${state.index + 1}/${state.total}`}
      </span>
      <button
        type="button"
        className="rounded p-1 hover:bg-[var(--color-bg-hover)]"
        onClick={() => editor?.commands.prevSearchMatch()}
        aria-label={t("editor:searchBar.previous")}
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="rounded p-1 hover:bg-[var(--color-bg-hover)]"
        onClick={() => editor?.commands.nextSearchMatch()}
        aria-label={t("editor:searchBar.next")}
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="rounded p-1 hover:bg-[var(--color-bg-hover)]"
        onClick={onClose}
        aria-label={t("editor:searchBar.close")}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
