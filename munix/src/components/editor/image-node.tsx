/* eslint-disable react-refresh/only-export-components --
 * 같은 파일에 NodeView 컴포넌트(ImageView)와 Tiptap extension(VaultImage)을 같이
 * export. extension은 컴포넌트가 아니라 fast-refresh 대상이 아니므로 분리할
 * 실익이 적음. 컴포넌트만 변경 시 fast-refresh가 안 되는 것은 trade-off로 수용.
 */
import { useEffect, useRef, useState } from "react";
import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { useVaultStore } from "@/store/vault-store";
import { cn } from "@/lib/cn";

const MIN_WIDTH = 64;
const MAX_WIDTH = 2000;

function isExternalUrl(src: string): boolean {
  return (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:") ||
    src.startsWith("blob:") ||
    src.startsWith("asset:") ||
    src.startsWith("tauri:")
  );
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const { t } = useTranslation(["editor"]);
  const src = (node.attrs.src as string) ?? "";
  const alt = (node.attrs.alt as string | null) ?? "";
  const widthAttr = node.attrs.width as number | null | undefined;
  const info = useVaultStore((s) => s.info);
  const [resolved, setResolved] = useState<string>(src);
  const [draftAlt, setDraftAlt] = useState<string>(alt);
  const [draftWidth, setDraftWidth] = useState<number | null>(
    typeof widthAttr === "number" ? widthAttr : null,
  );
  const [resizing, setResizing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    if (!src || isExternalUrl(src)) {
      setResolved(src);
      return;
    }
    if (!info) {
      setResolved(src);
      return;
    }
    // rel path → absolute → convertFileSrc
    const abs = `${info.root}/${src}`;
    const converted = convertFileSrc(abs);
    if (!cancelled) setResolved(converted);
    return () => {
      cancelled = true;
    };
  }, [src, info]);

  // node attrs가 외부에서 바뀌면 draft 동기화
  useEffect(() => {
    setDraftAlt(alt);
  }, [alt]);
  useEffect(() => {
    setDraftWidth(typeof widthAttr === "number" ? widthAttr : null);
  }, [widthAttr]);

  // 선택되면 alt input 자동 포커스
  useEffect(() => {
    if (selected) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [selected]);

  const commitAlt = () => {
    if (draftAlt !== alt) {
      updateAttributes({ alt: draftAlt });
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    const startWidth = img.getBoundingClientRect().width;
    resizeStartRef.current = { startX: e.clientX, startWidth };
    setResizing(true);

    const onMove = (ev: MouseEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const delta = ev.clientX - start.startX;
      const next = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, Math.round(start.startWidth + delta)),
      );
      setDraftWidth(next);
    };
    const onUp = () => {
      const final = resizeStartRef.current;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      resizeStartRef.current = null;
      setResizing(false);
      if (!final) return;
      // setDraftWidth가 비동기라 마지막 값을 직접 계산
      const img2 = imgRef.current;
      const finalWidth = img2
        ? Math.round(img2.getBoundingClientRect().width)
        : null;
      if (finalWidth && finalWidth !== widthAttr) {
        updateAttributes({ width: finalWidth });
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const clearWidth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (widthAttr != null) {
      updateAttributes({ width: null });
    }
    setDraftWidth(null);
  };

  return (
    <NodeViewWrapper
      as="span"
      className="relative inline-block"
      data-drag-handle
    >
      <img
        ref={imgRef}
        src={resolved}
        alt={draftAlt}
        style={draftWidth ? { width: `${draftWidth}px` } : undefined}
        className={cn(
          "inline-block max-w-full rounded border",
          "border-[var(--color-border-secondary)]",
          selected && "ring-2 ring-[var(--color-accent)]",
          resizing && "select-none",
        )}
      />
      {selected && (
        <>
          {/* 우측 하단 resize 핸들 — selected 시에만 표시 */}
          <span
            contentEditable={false}
            role="slider"
            aria-label={t("editor:image.resizeHandle")}
            aria-valuenow={draftWidth ?? 0}
            onMouseDown={handleResizeStart}
            onDoubleClick={clearWidth}
            title={t("editor:image.resizeHint")}
            className={cn(
              "absolute bottom-1 right-1 h-3 w-3 cursor-nwse-resize rounded-sm",
              "bg-[var(--color-accent)] shadow-sm",
              "ring-1 ring-white/40",
            )}
          />
          {/* 크기 표시 (resizing 중에만) */}
          {resizing && draftWidth != null && (
            <span
              contentEditable={false}
              className={cn(
                "absolute -top-7 right-1 rounded px-2 py-0.5 text-[10px]",
                "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]",
                "border border-[var(--color-border-secondary)] shadow-sm",
              )}
            >
              {draftWidth}px
            </span>
          )}
          <span
            contentEditable={false}
            className={cn(
              "absolute left-1 right-6 bottom-1 flex items-center gap-1 rounded",
              "bg-[var(--color-bg-secondary)]/95 backdrop-blur px-2 py-1",
              "border border-[var(--color-border-secondary)] shadow-sm",
            )}
          >
            <span className="text-[10px] uppercase text-[var(--color-text-tertiary)]">
              alt
            </span>
            <input
              ref={inputRef}
              type="text"
              value={draftAlt}
              onChange={(e) => setDraftAlt(e.target.value)}
              onBlur={commitAlt}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitAlt();
                  inputRef.current?.blur();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setDraftAlt(alt);
                  inputRef.current?.blur();
                }
              }}
              placeholder={t("editor:image.altPlaceholder")}
              className={cn(
                "flex-1 bg-transparent px-1 py-0 text-xs outline-none",
                "text-[var(--color-text-primary)]",
                "placeholder:text-[var(--color-text-tertiary)]",
              )}
            />
          </span>
        </>
      )}
    </NodeViewWrapper>
  );
}

/** 커스텀 Image 노드: rel path로 저장, 렌더 시 tauri asset URL로 변환.
 * width attribute을 추가해 사용자가 NodeView 핸들로 크기 조절 가능.
 * 직렬화 시 width가 있으면 inline HTML(<img ...>), 없으면 표준 markdown(![alt](src)).
 * Obsidian 호환: GFM 안의 inline HTML은 표준이며 Obsidian도 정상 렌더. */
export const VaultImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = el.getAttribute("width");
          if (!w) return null;
          const n = Number(w);
          return Number.isFinite(n) && n > 0 ? n : null;
        },
        renderHTML: (attrs: { width?: number | null }) => {
          if (!attrs.width) return {};
          return { width: String(attrs.width) };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },

  addStorage() {
    const parent = this.parent?.() ?? {};
    return {
      ...parent,
      markdown: {
        serialize(
          state: { write: (s: string) => void },
          node: {
            attrs: {
              src?: string;
              alt?: string | null;
              title?: string | null;
              width?: number | null;
            };
          },
        ) {
          const src = node.attrs.src ?? "";
          const alt = node.attrs.alt ?? "";
          const title = node.attrs.title ?? null;
          const width = node.attrs.width;
          if (width) {
            const altAttr = alt ? ` alt="${escapeHtmlAttr(alt)}"` : "";
            const titleAttr = title ? ` title="${escapeHtmlAttr(title)}"` : "";
            state.write(
              `<img src="${escapeHtmlAttr(src)}"${altAttr}${titleAttr} width="${width}">`,
            );
          } else {
            const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";
            state.write(`![${alt}](${src}${titlePart})`);
          }
        },
        parse: {},
      },
    };
  },
});
