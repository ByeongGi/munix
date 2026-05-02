import katex from "katex";

const MATH_RENDER_CACHE_LIMIT = 120;
const mathRenderCache = new Map<string, string>();

export function renderMathToString(
  latex: string,
  displayMode: boolean,
): string {
  const key = `${displayMode ? "block" : "inline"}\n${latex}`;
  const cached = mathRenderCache.get(key);
  if (cached) {
    mathRenderCache.delete(key);
    mathRenderCache.set(key, cached);
    return cached;
  }

  const html = renderKatex(latex, displayMode);
  mathRenderCache.set(key, html);
  if (mathRenderCache.size > MATH_RENDER_CACHE_LIMIT) {
    const oldest = mathRenderCache.keys().next().value;
    if (oldest) mathRenderCache.delete(oldest);
  }
  return html;
}

function renderKatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode,
    });
  } catch {
    return `<span class="munix-math-error">${escapeHtml(latex)}</span>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
