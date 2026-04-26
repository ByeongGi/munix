export type PaletteMode = "file" | "command" | "tag" | "heading" | "line";

export function parseMode(query: string): {
  mode: PaletteMode;
  text: string;
} {
  if (query.startsWith(">")) {
    return { mode: "command", text: query.slice(1).trimStart() };
  }
  if (query.startsWith("#")) return { mode: "tag", text: query.slice(1) };
  if (query.startsWith("@")) return { mode: "heading", text: query.slice(1) };
  if (query.startsWith(":")) return { mode: "line", text: query.slice(1) };
  return { mode: "file", text: query };
}

export function extractHeadings(
  body: string,
): { text: string; level: number }[] {
  const headings: { text: string; level: number }[] = [];
  for (const line of body.split("\n")) {
    const m = /^(#{1,6})\s+(.+)$/.exec(line);
    if (m && m[1] && m[2]) {
      headings.push({ level: m[1].length, text: m[2].trim() });
    }
  }
  return headings;
}
