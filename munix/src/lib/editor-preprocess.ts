function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function withCodeProtected(
  md: string,
  transform: (s: string) => string,
): string {
  const tokens: string[] = [];
  const fence = "\u0000F\u0000";
  const inline = "\u0000I\u0000";
  let out = md.replace(/```[\s\S]*?```/g, (m) => {
    tokens.push(m);
    return `${fence}${tokens.length - 1}${fence}`;
  });
  out = out.replace(/`[^`\n]+`/g, (m) => {
    tokens.push(m);
    return `${inline}${tokens.length - 1}${inline}`;
  });

  out = transform(out);

  out = out.replace(
    new RegExp(`${fence}(\\d+)${fence}`, "g"),
    (_, i: string) => tokens[Number(i)] ?? "",
  );
  out = out.replace(
    new RegExp(`${inline}(\\d+)${inline}`, "g"),
    (_, i: string) => tokens[Number(i)] ?? "",
  );
  return out;
}

/** Obsidian 확장 문법을 Tiptap이 이해하는 HTML로 변환 (로드 시 1회). */
export function preprocessMarkdown(md: string): string {
  return withCodeProtected(md, (input) => {
    let out = input;
    out = out.replace(
      /(^|\n)\$\$\n([\s\S]+?)\n\$\$(?=\n|$)/g,
      (_m, prefix: string, latex: string) =>
        `${prefix}<div data-math-block="${escapeAttr(latex)}"></div>`,
    );
    out = out.replace(
      /(^|[^\\$])\$([^\s$][^$\n]*?[^\s$]|[^\s$])\$/g,
      (_m, prefix: string, latex: string) =>
        `${prefix}<span data-math-inline="${escapeAttr(latex)}"></span>`,
    );
    out = out.replace(/==(\S(?:[^=]*?\S)?)==/g, (_, inner: string) => {
      return `<mark>${inner}</mark>`;
    });
    out = out.replace(
      /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g,
      (_m, rawTarget: string, rawAlias?: string) => {
        const target = rawTarget.trim();
        const alias = rawAlias?.trim() ?? "";
        const display = alias || target;
        const aliasAttr = alias
          ? ` data-wikilink-alias="${escapeAttr(alias)}"`
          : "";
        return `<span data-wikilink-target="${escapeAttr(target)}"${aliasAttr}>${escapeText(`[[${display}]]`)}</span>`;
      },
    );
    out = out.replace(
      /^\[\^([^\]\s]+)\]:[ \t]+(.+)$/gm,
      (_m, rawId: string, rawText: string) => {
        const id = rawId.trim();
        return `<div data-fndef="${escapeAttr(id)}">${rawText}</div>`;
      },
    );
    out = out.replace(/\[\^([^\]\s]+)\]/g, (_m, rawId: string) => {
      const id = rawId.trim();
      return `<sup data-fnref="${escapeAttr(id)}">${escapeText(id)}</sup>`;
    });
    return out;
  });
}
