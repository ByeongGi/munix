import type { FileNode } from "@/types/ipc";

export interface CliFileTarget {
  path?: string | null;
  file?: string | null;
}

export interface CliCreateTarget {
  path?: string | null;
  name?: string | null;
}

export function resolveFileTargetPathFromNodes(
  target: CliFileTarget,
  files: FileNode[],
): string {
  if (target.path) return target.path;
  if (!target.file) {
    throw new Error("expected path=... or file=...");
  }

  const input = normalizeTarget(target.file);
  const nodes = flattenFiles(files).filter((node) => node.kind === "file");
  const exactPath = findSingleMatch(
    nodes,
    (node) =>
      normalizeTarget(node.path) === input ||
      stripMarkdownExtension(normalizeTarget(node.path)) === input,
    target.file,
  );
  if (exactPath) return exactPath.path;

  const basenameMatches = nodes.filter((node) => {
    const name = normalizeTarget(node.name);
    return name === input || stripMarkdownExtension(name) === input;
  });

  if (basenameMatches.length === 0) {
    throw new Error(`File not found: ${target.file}`);
  }
  if (basenameMatches.length > 1) {
    throw new Error(
      `Ambiguous file target: ${target.file} (${basenameMatches
        .map((node) => node.path)
        .join(", ")})`,
    );
  }

  return basenameMatches[0]!.path;
}

export function resolveCreatePathFromNodes(
  target: CliCreateTarget,
  files: FileNode[],
): string {
  if (target.path) {
    const path = normalizeTarget(target.path);
    if (!path) throw new Error("create requires a non-empty path");
    return ensureMarkdownExtension(path);
  }
  if (target.name) return pathFromName(target.name);
  return nextUntitledPath(files);
}

export function appendContent(
  current: string,
  content: string,
  inline: boolean,
): string {
  if (inline) return `${current}${content}`;
  return joinBlocks(current, content);
}

export function prependContent(
  current: string,
  content: string,
  inline: boolean,
): string {
  const { frontmatter, body } = splitFrontmatter(current);
  const nextBody = inline ? `${content}${body}` : joinBlocks(content, body);
  return `${frontmatter}${nextBody}`;
}

function findSingleMatch(
  nodes: FileNode[],
  predicate: (node: FileNode) => boolean,
  rawTarget: string,
): FileNode | null {
  const matches = nodes.filter(predicate);
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous file target: ${rawTarget} (${matches
        .map((node) => node.path)
        .join(", ")})`,
    );
  }
  return matches[0]!;
}

function flattenFiles(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.shift();
    if (!node) continue;
    out.push(node);
    if (node.children) stack.unshift(...node.children);
  }
  return out;
}

function normalizeTarget(value: string): string {
  return value.trim().replaceAll("\\", "/").replace(/^\/+/, "");
}

function stripMarkdownExtension(value: string): string {
  return value.replace(/\.md$/i, "");
}

function ensureMarkdownExtension(value: string): string {
  return /\.md$/i.test(value) ? value : `${value}.md`;
}

function pathFromName(name: string): string {
  const normalized = normalizeTarget(name);
  if (!normalized) throw new Error("create requires a non-empty name");
  if (normalized.includes("/")) {
    throw new Error("create name=... must be a file name, not a path");
  }
  return ensureMarkdownExtension(normalized);
}

function nextUntitledPath(files: FileNode[]): string {
  const paths = new Set(
    flattenFiles(files)
      .filter((node) => node.kind === "file")
      .map((node) => normalizeTarget(node.path).toLowerCase()),
  );

  let index = 0;
  while (true) {
    const path = index === 0 ? "Untitled.md" : `Untitled ${index}.md`;
    if (!paths.has(path.toLowerCase())) return path;
    index += 1;
  }
}

function joinBlocks(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return `${a.replace(/\s*$/, "")}\n${b.replace(/^\s*/, "")}`;
}

function splitFrontmatter(content: string): {
  frontmatter: string;
  body: string;
} {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    return { frontmatter: "", body: content };
  }

  const match = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(content);
  if (!match) return { frontmatter: "", body: content };

  const frontmatter = match[0].endsWith("\n") ? match[0] : `${match[0]}\n`;
  return {
    frontmatter,
    body: content.slice(match[0].length),
  };
}
