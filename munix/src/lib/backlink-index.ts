import { ipc } from "@/lib/ipc";
import type { FileNode } from "@/types/ipc";

const WIKILINK_RE = /\[\[([^\]|\n]+)(?:\|[^\]\n]+)?\]\]/g;

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  const name = i < 0 ? path : path.slice(i + 1);
  return name.replace(/\.md$/i, "");
}

function flattenMd(nodes: FileNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (n.kind === "file" && /\.md$/i.test(n.name)) out.push(n.path);
    if (n.children) flattenMd(n.children, out);
  }
  return out;
}

export interface BacklinkHit {
  sourcePath: string;
  sourceTitle: string;
  snippets: string[]; // 링크가 포함된 줄 최대 3개
}

export class BacklinkIndex {
  // source path → set of target basenames
  private forward = new Map<string, Set<string>>();
  // target basename → set of source paths
  private reverse = new Map<string, Set<string>>();
  // source path → raw body (for snippet 생성)
  private bodies = new Map<string, string>();

  async build(files: FileNode[], vaultId?: string): Promise<void> {
    this.forward.clear();
    this.reverse.clear();
    this.bodies.clear();
    const paths = flattenMd(files);
    const contents = await ipc.readMarkdownBatch(paths, vaultId);
    for (const content of contents) {
      this.applyPath(content.path, content.body);
    }
  }

  private applyPath(path: string, body: string): void {
    // 기존 링크 제거
    const prev = this.forward.get(path);
    if (prev) {
      for (const t of prev) {
        this.reverse.get(t)?.delete(path);
      }
    }
    // 새 링크 등록
    const targets = extractWikilinkTargets(body);
    this.forward.set(path, targets);
    this.bodies.set(path, body);
    for (const t of targets) {
      if (!this.reverse.has(t)) this.reverse.set(t, new Set());
      this.reverse.get(t)!.add(path);
    }
  }

  async updateDoc(path: string, vaultId?: string): Promise<void> {
    try {
      const content = await ipc.readMarkdownFile(path, vaultId);
      this.applyPath(path, content.body);
    } catch {
      this.removeDoc(path);
    }
  }

  removeDoc(path: string): void {
    const prev = this.forward.get(path);
    if (prev) {
      for (const t of prev) {
        this.reverse.get(t)?.delete(path);
      }
    }
    this.forward.delete(path);
    this.bodies.delete(path);
  }

  renamePath(oldPath: string, newPath: string): void {
    // 1) source 쪽: forward/bodies 키 교체, reverse 안의 sourcePath 교체
    const targets = this.forward.get(oldPath);
    if (targets) {
      this.forward.delete(oldPath);
      this.forward.set(newPath, targets);
      for (const t of targets) {
        const set = this.reverse.get(t);
        if (set) {
          set.delete(oldPath);
          set.add(newPath);
        }
      }
    }
    const body = this.bodies.get(oldPath);
    if (body !== undefined) {
      this.bodies.delete(oldPath);
      this.bodies.set(newPath, body);
    }

    // 2) target 쪽: reverse 키(basename) 교체
    const oldBase = basename(oldPath);
    const newBase = basename(newPath);
    if (oldBase !== newBase) {
      const sources = this.reverse.get(oldBase);
      if (sources) {
        this.reverse.delete(oldBase);
        this.reverse.set(newBase, sources);
      }
    }
  }

  backlinksOf(currentPath: string): BacklinkHit[] {
    const title = basename(currentPath);
    const sources = this.reverse.get(title);
    if (!sources || sources.size === 0) return [];
    const hits: BacklinkHit[] = [];
    for (const src of sources) {
      if (src === currentPath) continue;
      const body = this.bodies.get(src) ?? "";
      const snippets = extractSnippets(body, title).slice(0, 3);
      hits.push({
        sourcePath: src,
        sourceTitle: basename(src),
        snippets,
      });
    }
    return hits.sort((a, b) => a.sourceTitle.localeCompare(b.sourceTitle));
  }

  forwardLinksOf(currentPath: string): string[] {
    const targets = this.forward.get(currentPath);
    if (!targets) return [];
    return Array.from(targets).sort();
  }
}

function extractWikilinkTargets(body: string): Set<string> {
  const out = new Set<string>();
  WIKILINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKILINK_RE.exec(body)) !== null) {
    const raw = m[1]?.trim();
    if (raw) out.add(raw);
  }
  return out;
}

function extractSnippets(body: string, target: string): string[] {
  const lines = body.split("\n");
  const needle = new RegExp(
    `\\[\\[${escapeRegex(target)}(?:\\|[^\\]]+)?\\]\\]`,
  );
  const result: string[] = [];
  for (const line of lines) {
    if (needle.test(line)) {
      const trimmed = line.trim();
      result.push(trimmed.length > 140 ? trimmed.slice(0, 140) + "…" : trimmed);
    }
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
