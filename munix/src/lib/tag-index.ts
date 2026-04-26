import { ipc } from "@/lib/ipc";
import { parseDocument } from "@/lib/markdown";
import type { FileNode } from "@/types/ipc";

// 인라인 태그: #foo, #project/subtag — 단어 경계 직전이 공백/줄 시작/문장부호
// 코드 블럭 내부는 제외
const INLINE_TAG_RE = /(^|\s)#([\p{L}\p{N}][\p{L}\p{N}_/-]*)/gu;

function flattenMd(nodes: FileNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (n.kind === "file" && /\.md$/i.test(n.name)) out.push(n.path);
    if (n.children) flattenMd(n.children, out);
  }
  return out;
}

function extractInlineTags(body: string): Set<string> {
  const result = new Set<string>();
  // fenced code block (``` … ```) 먼저 제거 — 여러 줄 걸침
  const stripped = body.replace(/```[\s\S]*?```/g, "");

  for (const line of stripped.split(/\r?\n/)) {
    // indented code block: 라인 시작이 4+ 공백 또는 탭 → CommonMark상 코드.
    // `      #project/foo` 같은 줄이 태그로 잡히면 안 됨.
    if (/^( {4,}|\t)/.test(line)) continue;

    // 인라인 코드 (`…`) 만 라인 단위로 제거 후 태그 추출
    const noCode = line.replace(/`[^`]+`/g, "");
    INLINE_TAG_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = INLINE_TAG_RE.exec(noCode)) !== null) {
      const tag = m[2]?.trim();
      if (tag) result.add(tag);
    }
  }
  return result;
}

function extractFrontmatterTags(fm: Record<string, unknown> | null): string[] {
  if (!fm) return [];
  const v = fm.tags ?? fm.tag;
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  if (typeof v === "string") {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export class TagIndex {
  // tag → set of paths
  private byTag = new Map<string, Set<string>>();
  // path → tags (for incremental updates)
  private byPath = new Map<string, Set<string>>();

  async build(files: FileNode[], vaultId?: string): Promise<void> {
    this.byTag.clear();
    this.byPath.clear();
    for (const p of flattenMd(files)) {
      try {
        const content = await ipc.readFile(p, vaultId);
        const parsed = parseDocument(content.content);
        this.applyPath(p, parsed.body, parsed.frontmatter);
      } catch {
        // skip
      }
    }
  }

  async updateDoc(path: string, vaultId?: string): Promise<void> {
    try {
      const content = await ipc.readFile(path, vaultId);
      const parsed = parseDocument(content.content);
      this.applyPath(path, parsed.body, parsed.frontmatter);
    } catch {
      this.removeDoc(path);
    }
  }

  private applyPath(
    path: string,
    body: string,
    fm: Record<string, unknown> | null,
  ): void {
    // 기존 태그 제거
    const prev = this.byPath.get(path);
    if (prev) {
      for (const t of prev) {
        this.byTag.get(t)?.delete(path);
        if (this.byTag.get(t)?.size === 0) this.byTag.delete(t);
      }
    }
    const merged = new Set<string>();
    for (const t of extractInlineTags(body)) merged.add(t);
    for (const t of extractFrontmatterTags(fm)) merged.add(t);
    this.byPath.set(path, merged);
    for (const t of merged) {
      if (!this.byTag.has(t)) this.byTag.set(t, new Set());
      this.byTag.get(t)!.add(path);
    }
  }

  removeDoc(path: string): void {
    const prev = this.byPath.get(path);
    if (prev) {
      for (const t of prev) {
        this.byTag.get(t)?.delete(path);
        if (this.byTag.get(t)?.size === 0) this.byTag.delete(t);
      }
    }
    this.byPath.delete(path);
  }

  renamePath(oldPath: string, newPath: string): void {
    const tags = this.byPath.get(oldPath);
    if (!tags) return;
    this.byPath.delete(oldPath);
    this.byPath.set(newPath, tags);
    for (const t of tags) {
      const set = this.byTag.get(t);
      if (set) {
        set.delete(oldPath);
        set.add(newPath);
      }
    }
  }

  /** 태그별 개수 (내림차순). */
  tags(): { tag: string; count: number }[] {
    return Array.from(this.byTag.entries())
      .map(([tag, set]) => ({ tag, count: set.size }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  filesOf(tag: string): string[] {
    return Array.from(this.byTag.get(tag) ?? []).sort();
  }

  tagsOf(path: string): string[] {
    return Array.from(this.byPath.get(path) ?? []).sort();
  }
}
