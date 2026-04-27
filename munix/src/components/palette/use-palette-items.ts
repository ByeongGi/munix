import { useMemo } from "react";

import { extractHeadings, type PaletteMode } from "./command-palette-utils";
import type { PaletteItem } from "./palette-items";
import type { PaletteCommand } from "./use-palette-commands";
import type { SearchHit } from "@/lib/search-index";
import { useEditorStore } from "@/store/editor-store";
import { useRecentStore } from "@/store/recent-store";
import { useSearchStore, type IndexStatus } from "@/store/search-store";
import { useTagStore } from "@/store/tag-store";
import type { TagsStatus } from "@/store/slices/tags-slice";

interface UsePaletteItemsParams {
  commands: PaletteCommand[];
  mode: PaletteMode;
  text: string;
}

interface UsePaletteItemsResult {
  items: PaletteItem[];
  searchStatus: IndexStatus;
  tagStatus: TagsStatus;
}

function getFileItems({
  query,
  recentPaths,
  searchIndex,
}: {
  query: string;
  recentPaths: string[];
  searchIndex: ReturnType<typeof useSearchStore.getState>["index"];
}): PaletteItem[] {
  if (query) {
    return searchIndex
      .searchByTitle(query, 30)
      .map((hit) => ({ kind: "file" as const, hit }));
  }

  const all = searchIndex.searchByTitle("", 100);
  const byPath = new Map(all.map((hit) => [hit.path, hit]));
  const recent = recentPaths
    .map((path) => byPath.get(path))
    .filter((hit): hit is SearchHit => Boolean(hit));
  const rest = all.filter((hit) => !recentPaths.includes(hit.path));

  return [...recent, ...rest]
    .slice(0, 30)
    .map((hit) => ({ kind: "file" as const, hit }));
}

export function usePaletteItems({
  commands,
  mode,
  text,
}: UsePaletteItemsParams): UsePaletteItemsResult {
  const searchIndex = useSearchStore((s) => s.index);
  const searchStatus = useSearchStore((s) => s.status);
  const tagIndex = useTagStore((s) => s.index);
  const tagStatus = useTagStore((s) => s.status);
  const recentPaths = useRecentStore((s) => s.paths);
  const editorBody = useEditorStore((s) => s.body);

  const items = useMemo<PaletteItem[]>(() => {
    if (mode === "file") {
      if (searchStatus !== "ready") return [];
      return getFileItems({
        query: text.trim(),
        recentPaths,
        searchIndex,
      });
    }

    if (mode === "command") {
      const query = text.toLowerCase();
      const filtered = query
        ? commands.filter(
            (command) =>
              command.title.toLowerCase().includes(query) ||
              command.keywords?.some((keyword) =>
                keyword.toLowerCase().includes(query),
              ),
          )
        : commands;

      return filtered.map((cmd) => ({ kind: "command" as const, cmd }));
    }

    if (mode === "tag") {
      if (tagStatus !== "ready") return [];
      const query = text.toLowerCase().replace(/^#/, "");
      const all = tagIndex.tags();
      const filtered = query
        ? all.filter((hit) => hit.tag.toLowerCase().includes(query))
        : all;

      return filtered.slice(0, 30).map((hit) => ({
        kind: "tag" as const,
        tag: hit.tag,
        fileCount: hit.count,
      }));
    }

    if (mode === "heading") {
      const headings = extractHeadings(editorBody);
      const query = text.toLowerCase();
      const filtered = query
        ? headings.filter((heading) => heading.text.toLowerCase().includes(query))
        : headings;

      return filtered.map((heading, index) => ({
        kind: "heading" as const,
        text: heading.text,
        level: heading.level,
        index,
      }));
    }

    if (mode === "line") {
      const lineNum = parseInt(text, 10);
      if (!Number.isNaN(lineNum) && lineNum > 0) {
        return [{ kind: "line" as const, lineNum }];
      }
    }

    return [];
  }, [
    mode,
    text,
    commands,
    searchIndex,
    searchStatus,
    recentPaths,
    editorBody,
    tagIndex,
    tagStatus,
  ]);

  return { items, searchStatus, tagStatus };
}
