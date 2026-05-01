import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEditorStore } from "@/store/editor-store";
import { useBacklinkStore } from "@/store/backlink-store";
import { useTabStore } from "@/store/tab-store";
import { useVaultStore } from "@/store/vault-store";
import { cn } from "@/lib/cn";

interface Heading {
  level: number;
  text: string;
  index: number;
}

function extractHeadings(body: string): Heading[] {
  const lines = body.split("\n");
  const headings: Heading[] = [];
  let inFence = false;
  let fenceMarker: string | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const fenceMatch = /^(```|~~~)/.exec(line);
    if (fenceMatch) {
      const m = fenceMatch[1];
      if (!inFence) {
        inFence = true;
        fenceMarker = m ?? null;
      } else if (line.startsWith(fenceMarker ?? "```")) {
        inFence = false;
        fenceMarker = null;
      }
      continue;
    }
    if (inFence) continue;
    const atx = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (atx) {
      const hashes = atx[1] ?? "";
      const text = atx[2] ?? "";
      headings.push({
        level: hashes.length,
        text: text.trim(),
        index: headings.length,
      });
    }
  }
  return headings;
}

function scrollToHeadingIndex(index: number): void {
  const root = document.querySelector(".tiptap");
  if (!root) return;
  const hs = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const el = hs[index] as HTMLElement | undefined;
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function OutlinePanel() {
  const { t } = useTranslation(["panels"]);
  const body = useEditorStore((s) => s.body);
  const currentPath = useEditorStore((s) => s.currentPath);
  const info = useVaultStore((s) => s.info);
  const files = useVaultStore((s) => s.files);
  const build = useBacklinkStore((s) => s.build);
  const status = useBacklinkStore((s) => s.status);
  const builtFor = useBacklinkStore((s) => s.builtFor);
  const backlinksOf = useBacklinkStore((s) => s.backlinksOf);
  const openTab = useTabStore((s) => s.openTab);

  const headings = useMemo(() => extractHeadings(body), [body]);

  // 현재 viewport 상단에 가까운 헤딩의 인덱스. IntersectionObserver로 추적.
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const visibleSetRef = useRef<Set<number>>(new Set());

  // 키보드 포커스 인덱스 (활성 헤딩과는 독립). Tab으로 outline에 포커스 후 ↑↓ 이동.
  const [keyFocusIdx, setKeyFocusIdx] = useState<number | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  const handleSectionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (headings.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setKeyFocusIdx((i) =>
        i == null ? 0 : Math.min(i + 1, headings.length - 1),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setKeyFocusIdx((i) => (i == null ? 0 : Math.max(i - 1, 0)));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = keyFocusIdx ?? activeIdx ?? 0;
      scrollToHeadingIndex(idx);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setKeyFocusIdx(null);
      sectionRef.current?.blur();
    } else if (e.key === "Home") {
      e.preventDefault();
      setKeyFocusIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setKeyFocusIdx(headings.length - 1);
    }
  };

  useEffect(() => {
    if (headings.length === 0) {
      setActiveIdx(null);
      return;
    }
    // .tiptap 안에 헤딩이 렌더된 후 매핑. ProseMirror가 비동기로 그리므로
    // requestAnimationFrame 한 틱 미루기.
    let observer: IntersectionObserver | null = null;
    let cancelled = false;

    const setup = () => {
      if (cancelled) return;
      const root = document.querySelector(".tiptap");
      if (!root) {
        // 아직 안 렌더됨 — 다음 틱 재시도
        requestAnimationFrame(setup);
        return;
      }
      const scrollContainer = root.parentElement;
      if (!scrollContainer) return;
      const els = root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
      if (els.length === 0) return;

      visibleSetRef.current.clear();

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const idx = Number(
              (entry.target as HTMLElement).dataset.outlineIdx,
            );
            if (Number.isNaN(idx)) continue;
            if (entry.isIntersecting) visibleSetRef.current.add(idx);
            else visibleSetRef.current.delete(idx);
          }
          if (visibleSetRef.current.size > 0) {
            setActiveIdx(Math.min(...visibleSetRef.current));
          }
        },
        {
          root: scrollContainer,
          // 헤딩이 viewport 상단 근처에 있을 때만 active로. 하단은 70% 잘라냄.
          rootMargin: "0px 0px -70% 0px",
          threshold: 0,
        },
      );

      els.forEach((el, i) => {
        el.dataset.outlineIdx = String(i);
        observer!.observe(el);
      });
    };

    setup();
    // ref 값을 effect 시점에 캡처해 cleanup이 안전하게 사용 (effect 동안 ref가
    // 다른 Set으로 바뀔 가능성은 없지만 react-hooks/exhaustive-deps 룰 만족용).
    const visibleAtMount = visibleSetRef.current;
    return () => {
      cancelled = true;
      observer?.disconnect();
      visibleAtMount.clear();
    };
  }, [headings, currentPath]);

  useEffect(() => {
    if (!info) return;
    if (builtFor === info.root && status === "ready") return;
    if (status === "building") return;
    void build(info.root, files);
  }, [info, files, builtFor, status, build]);

  const backlinks = useMemo(() => {
    if (!currentPath || status !== "ready") return [];
    return backlinksOf(currentPath);
  }, [currentPath, status, backlinksOf]);

  if (!currentPath) {
    return (
      <div className="px-3 py-4 text-xs text-[var(--color-text-tertiary)]">
        {t("panels:outline.selectFile")}
      </div>
    );
  }

  return (
    <div
      ref={sectionRef}
      tabIndex={headings.length > 0 ? 0 : -1}
      onKeyDown={handleSectionKeyDown}
      className="divide-y divide-[var(--color-border-secondary)] outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]"
    >
      <section>
        <header className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
          {t("panels:outline.title")}
        </header>
        {headings.length === 0 ? (
          <div className="px-3 pb-2 text-xs text-[var(--color-text-tertiary)]">
            {t("panels:outline.empty")}
          </div>
        ) : (
          <ul className="pb-2">
            {headings.map((h, i) => {
              const isActive = activeIdx === i;
              const isKeyFocused = keyFocusIdx === i;
              return (
                <li key={`${h.level}-${i}-${h.text}`}>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => scrollToHeadingIndex(i)}
                    onMouseEnter={() => setKeyFocusIdx(i)}
                    style={{ paddingLeft: `${8 + (h.level - 1) * 10}px` }}
                    className={cn(
                      "flex w-full items-center gap-1 py-1 pr-3 text-left text-xs",
                      "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
                      h.level === 1 &&
                        "font-semibold text-[var(--color-text-primary)]",
                      isActive &&
                        "bg-[var(--color-accent-muted)] text-[var(--color-accent)] font-semibold border-l-2 border-[var(--color-accent)]",
                      isKeyFocused &&
                        "ring-1 ring-inset ring-[var(--color-accent)]",
                    )}
                    title={h.text}
                  >
                    <span className="truncate">
                      {h.text || t("panels:outline.emptyTitle")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <header className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
          <Link2 className="h-3 w-3" />
          {t("panels:outline.backlinks")}
          {status === "building" && (
            <span className="ml-auto text-[10px]">
              {t("panels:outline.indexing")}
            </span>
          )}
        </header>
        {status !== "ready" ? (
          <div className="px-3 pb-2 text-xs text-[var(--color-text-tertiary)]">
            {status === "building" ? t("panels:outline.building") : "—"}
          </div>
        ) : backlinks.length === 0 ? (
          <div className="px-3 pb-2 text-xs text-[var(--color-text-tertiary)]">
            {t("panels:outline.noBacklinks")}
          </div>
        ) : (
          <ul className="pb-2">
            {backlinks.map((hit) => (
              <li key={hit.sourcePath} className="px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => openTab(hit.sourcePath)}
                  className="flex w-full items-center gap-1.5 text-left text-xs font-medium text-[var(--color-text-primary)] hover:underline"
                  title={hit.sourcePath}
                >
                  <FileText className="h-3 w-3 shrink-0 text-[var(--color-text-tertiary)]" />
                  <span className="truncate">{hit.sourceTitle}</span>
                </button>
                {hit.snippets.map((snip, i) => (
                  <div
                    key={i}
                    className="mt-0.5 truncate pl-4 text-[11px] text-[var(--color-text-tertiary)]"
                  >
                    {snip}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
