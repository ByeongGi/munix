import MiniSearch from "minisearch";
import { ipc } from "@/lib/ipc";
import type { FileNode } from "@/types/ipc";

export interface IndexedDoc {
  id: string; // rel path
  title: string; // filename
  body: string; // markdown body w/o frontmatter
}

export interface SearchHit {
  path: string;
  title: string;
  score: number;
  snippet: string;
  matchedLine: number;
}


function flattenFiles(nodes: FileNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (n.kind === "file") out.push(n.path);
    if (n.children) flattenFiles(n.children, out);
  }
  return out;
}

export class VaultSearchIndex {
  private mini: MiniSearch<IndexedDoc>;
  private docs = new Map<string, IndexedDoc>();

  constructor() {
    this.mini = new MiniSearch<IndexedDoc>({
      fields: ["title", "body"],
      storeFields: ["title"],
      searchOptions: {
        boost: { title: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
  }

  get size(): number {
    return this.docs.size;
  }

  async build(files: FileNode[], vaultId?: string): Promise<void> {
    const paths = flattenFiles(files);
    const docs: IndexedDoc[] = [];
    const contents = await ipc.readMarkdownBatch(paths, vaultId);
    for (const content of contents) {
      const name = content.path.split("/").pop() ?? content.path;
      const doc: IndexedDoc = {
        id: content.path,
        title: name.replace(/\.md$/i, ""),
        body: content.body,
      };
      docs.push(doc);
      this.docs.set(content.path, doc);
    }
    // 기존 인덱스 재초기화
    this.mini.removeAll();
    this.mini.addAll(docs);
  }

  search(query: string, limit = 50): SearchHit[] {
    if (!query.trim()) return [];
    const results = this.mini.search(query).slice(0, limit);
    const hits: SearchHit[] = [];
    for (const r of results) {
      const doc = this.docs.get(r.id);
      if (!doc) continue;
      const { snippet, line } = makeSnippet(doc.body, query);
      hits.push({
        path: doc.id,
        title: doc.title,
        score: r.score,
        snippet,
        matchedLine: line,
      });
    }
    return hits;
  }

  /** 정규식 모드 — MiniSearch 우회하고 모든 doc.body를 RegExp.test로 검사.
   * 잘못된 정규식이면 throw — 호출 측에서 try/catch로 잡고 사용자에게 표시.
   * 결과는 매치된 첫 라인의 위치/스니펫. score는 매치 수 기반.
   */
  searchRegex(pattern: string, limit = 50): SearchHit[] {
    if (!pattern.trim()) return [];
    const re = new RegExp(pattern, "i");
    const hits: SearchHit[] = [];
    for (const doc of this.docs.values()) {
      const lines = doc.body.split("\n");
      let firstMatchLine = -1;
      let firstMatchSnippet = "";
      let matchCount = 0;
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] ?? "";
        const m = re.exec(line);
        if (m) {
          matchCount += 1;
          if (firstMatchLine < 0) {
            const idx = m.index;
            const start = Math.max(0, idx - 30);
            const end = Math.min(line.length, idx + (m[0]?.length ?? 0) + 60);
            let snippet = line.slice(start, end);
            if (start > 0) snippet = "…" + snippet;
            if (end < line.length) snippet = snippet + "…";
            firstMatchLine = i + 1;
            firstMatchSnippet = snippet;
          }
          // RegExp가 sticky 아니라 다음 라인부터 무한루프 위험 적음
        }
      }
      if (firstMatchLine > 0) {
        hits.push({
          path: doc.id,
          title: doc.title,
          score: matchCount,
          snippet: firstMatchSnippet,
          matchedLine: firstMatchLine,
        });
      }
      if (hits.length >= limit) break;
    }
    return hits.sort((a, b) => b.score - a.score);
  }

  searchByTitle(query: string, limit = 30): SearchHit[] {
    const trimmed = query.trim();
    if (!trimmed) {
      // 빈 쿼리면 최근 파일 또는 전체 목록 (여기선 전체 정렬)
      return Array.from(this.docs.values())
        .slice(0, limit)
        .map((doc) => ({
          path: doc.id,
          title: doc.title,
          score: 0,
          snippet: "",
          matchedLine: 0,
        }));
    }
    const results = this.mini
      .search(trimmed, { fields: ["title"], fuzzy: 0.3, prefix: true })
      .slice(0, limit);
    const hits: SearchHit[] = [];
    for (const r of results) {
      const doc = this.docs.get(r.id);
      if (!doc) continue;
      hits.push({
        path: doc.id,
        title: doc.title,
        score: r.score,
        snippet: "",
        matchedLine: 0,
      });
    }
    return hits;
  }

  updateDoc(path: string, newBody: string, newTitle?: string): void {
    const prev = this.docs.get(path);
    if (prev) this.mini.remove(prev);
    const name = newTitle ?? path.split("/").pop() ?? path;
    const doc: IndexedDoc = {
      id: path,
      title: name.replace(/\.md$/i, ""),
      body: newBody,
    };
    this.docs.set(path, doc);
    this.mini.add(doc);
  }

  removeDoc(path: string): void {
    const prev = this.docs.get(path);
    if (prev) {
      this.mini.remove(prev);
      this.docs.delete(path);
    }
  }

  renameDoc(oldPath: string, newPath: string): void {
    const doc = this.docs.get(oldPath);
    if (!doc) return;
    this.mini.remove(doc);
    this.docs.delete(oldPath);
    const newDoc: IndexedDoc = {
      ...doc,
      id: newPath,
      title:
        newPath.split("/").pop()?.replace(/\.md$/i, "") ?? newPath,
    };
    this.docs.set(newPath, newDoc);
    this.mini.add(newDoc);
  }

}

function makeSnippet(
  body: string,
  query: string,
): { snippet: string; line: number } {
  const q = query.toLowerCase();
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    if (line.toLowerCase().includes(q)) {
      const idx = line.toLowerCase().indexOf(q);
      const start = Math.max(0, idx - 30);
      const end = Math.min(line.length, idx + q.length + 60);
      let snippet = line.slice(start, end);
      if (start > 0) snippet = "…" + snippet;
      if (end < line.length) snippet = snippet + "…";
      return { snippet, line: i + 1 };
    }
  }
  // 매치 라인 못 찾아도 첫 줄로 fallback
  return { snippet: lines[0]?.slice(0, 100) ?? "", line: 1 };
}
