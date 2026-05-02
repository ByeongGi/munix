import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";

interface Match {
  from: number;
  to: number;
}

export interface SearchState {
  query: string;
  caseInsensitive: boolean;
  matches: Match[];
  currentIndex: number;
  decorations: DecorationSet;
}

export const searchKey = new PluginKey<SearchState>("search");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchHighlight: {
      setSearchQuery: (query: string, caseInsensitive?: boolean) => ReturnType;
      clearSearch: () => ReturnType;
      nextSearchMatch: () => ReturnType;
      prevSearchMatch: () => ReturnType;
    };
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatches(
  doc: PMNode,
  query: string,
  caseInsensitive: boolean,
): Match[] {
  if (!query) return [];
  const re = new RegExp(escapeRegex(query), caseInsensitive ? "gi" : "g");
  const matches: Match[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push({ from: pos + m.index, to: pos + m.index + m[0].length });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  });
  return matches;
}

function makeDecorations(
  doc: PMNode,
  matches: Match[],
  currentIndex: number,
): DecorationSet {
  return DecorationSet.create(
    doc,
    matches.map((m, i) =>
      Decoration.inline(m.from, m.to, {
        class:
          i === currentIndex
            ? "munix-search-match munix-search-match-current"
            : "munix-search-match",
      }),
    ),
  );
}

/**
 * SearchHighlight — Mod+F 인파일 검색용 Tiptap 확장.
 *
 * 사용법:
 *  editor.commands.setSearchQuery("keyword")
 *  editor.commands.nextSearchMatch() / prevSearchMatch()
 *  editor.commands.clearSearch()
 */
export const SearchHighlight = Extension.create({
  name: "searchHighlight",

  addCommands() {
    return {
      setSearchQuery:
        (query: string, caseInsensitive = true) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchKey, { type: "set", query, caseInsensitive });
            dispatch(tr);
          }
          return true;
        },
      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchKey, { type: "clear" });
            dispatch(tr);
          }
          return true;
        },
      nextSearchMatch:
        () =>
        ({ tr, dispatch, state }) => {
          const s = searchKey.getState(state);
          if (!s || s.matches.length === 0) return false;
          const next = (s.currentIndex + 1) % s.matches.length;
          if (dispatch) {
            tr.setMeta(searchKey, { type: "navigate", index: next });
            dispatch(tr);
          }
          return true;
        },
      prevSearchMatch:
        () =>
        ({ tr, dispatch, state }) => {
          const s = searchKey.getState(state);
          if (!s || s.matches.length === 0) return false;
          const prev =
            (s.currentIndex - 1 + s.matches.length) % s.matches.length;
          if (dispatch) {
            tr.setMeta(searchKey, { type: "navigate", index: prev });
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: (): SearchState => ({
            query: "",
            caseInsensitive: true,
            matches: [],
            currentIndex: 0,
            decorations: DecorationSet.empty,
          }),
          apply(
            tr: Transaction,
            prev: SearchState,
            _oldState: EditorState,
            newState: EditorState,
          ): SearchState {
            const meta = tr.getMeta(searchKey);

            let query = prev.query;
            let caseInsensitive = prev.caseInsensitive;
            let currentIndex = prev.currentIndex;
            let forceRebuild = false;

            if (meta) {
              if (meta.type === "clear") {
                return {
                  query: "",
                  caseInsensitive: prev.caseInsensitive,
                  matches: [],
                  currentIndex: 0,
                  decorations: DecorationSet.empty,
                };
              }
              if (meta.type === "set") {
                query = meta.query;
                caseInsensitive = meta.caseInsensitive;
                currentIndex = 0;
                forceRebuild = true;
              }
              if (meta.type === "navigate") {
                currentIndex = meta.index;
                return {
                  ...prev,
                  currentIndex,
                  decorations: makeDecorations(
                    newState.doc,
                    prev.matches,
                    currentIndex,
                  ),
                };
              }
            }

            if (!tr.docChanged && !forceRebuild) {
              return prev;
            }

            if (!query) {
              if (
                prev.query === "" &&
                prev.matches.length === 0 &&
                prev.currentIndex === 0
              ) {
                return prev;
              }
              return {
                query: "",
                caseInsensitive,
                matches: [],
                currentIndex: 0,
                decorations: DecorationSet.empty,
              };
            }

            const matches = findMatches(newState.doc, query, caseInsensitive);
            const safeIndex =
              matches.length === 0
                ? 0
                : Math.min(currentIndex, matches.length - 1);
            return {
              query,
              caseInsensitive,
              matches,
              currentIndex: safeIndex,
              decorations: makeDecorations(newState.doc, matches, safeIndex),
            };
          },
        },
        props: {
          decorations(state) {
            return searchKey.getState(state)?.decorations;
          },
        },
        view(view) {
          let lastIndex = -1;
          let lastQuery = "";
          return {
            update(editorView) {
              const s = searchKey.getState(editorView.state);
              if (!s || s.matches.length === 0) {
                lastIndex = -1;
                lastQuery = "";
                return;
              }
              if (s.currentIndex === lastIndex && s.query === lastQuery) return;
              lastIndex = s.currentIndex;
              lastQuery = s.query;
              const current = s.matches[s.currentIndex];
              if (!current) return;
              try {
                const dom = editorView.domAtPos(current.from);
                const el =
                  dom.node.nodeType === Node.ELEMENT_NODE
                    ? (dom.node as Element)
                    : dom.node.parentElement;
                el?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
              } catch {
                // 위치가 유효하지 않을 수 있음 (문서 변경 중)
              }
            },
          };
          void view; // unused
        },
      }),
    ];
  },
});
