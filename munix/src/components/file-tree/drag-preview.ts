export function buildDragPreview(paths: string[]): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const preview = document.createElement("div");
  preview.setAttribute("aria-hidden", "true");
  preview.className =
    "fixed -left-[9999px] -top-[9999px] flex items-center gap-2 rounded-md border px-3 py-2 shadow-lg";
  preview.style.border = "1px solid var(--color-border-primary)";
  preview.style.background = "var(--color-bg-secondary)";
  preview.style.color = "var(--color-text-primary)";
  preview.style.fontSize = "12px";
  preview.style.lineHeight = "1.2";
  preview.style.boxShadow = "0 12px 32px rgba(0, 0, 0, 0.35)";

  const icon = document.createElement("div");
  icon.textContent = "\u2195";
  icon.style.display = "flex";
  icon.style.alignItems = "center";
  icon.style.justifyContent = "center";
  icon.style.width = "20px";
  icon.style.height = "20px";
  icon.style.borderRadius = "9999px";
  icon.style.background = "var(--color-bg-hover)";
  icon.style.color = "var(--color-accent)";
  icon.style.fontSize = "11px";
  icon.style.flex = "0 0 auto";

  const text = document.createElement("div");
  text.style.display = "flex";
  text.style.flexDirection = "column";
  text.style.gap = "2px";

  const title = document.createElement("div");
  title.textContent = basename(paths[0] ?? "");
  title.style.fontWeight = "600";
  title.style.maxWidth = "240px";
  title.style.whiteSpace = "nowrap";
  title.style.overflow = "hidden";
  title.style.textOverflow = "ellipsis";

  const count = document.createElement("div");
  const lang =
    document.documentElement.lang ||
    (typeof navigator !== "undefined" ? navigator.language : "en");
  const isKo = /^ko\b/i.test(lang);
  count.textContent =
    paths.length === 1
      ? isKo
        ? "이동"
        : "Move"
      : isKo
        ? `${paths.length}개 항목`
        : `${paths.length} items`;
  count.style.color = "var(--color-text-tertiary)";
  count.style.fontSize = "11px";

  text.appendChild(title);
  text.appendChild(count);
  preview.appendChild(icon);
  preview.appendChild(text);
  document.body.appendChild(preview);
  return preview;
}

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? path : path.slice(i + 1);
}
