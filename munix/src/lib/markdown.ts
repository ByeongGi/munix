import yaml from "js-yaml";

export interface ParsedDocument {
  frontmatter: Record<string, unknown> | null;
  body: string;
}

/** YAML frontmatter (`---\n…\n---\n`) 와 본문을 분리. gray-matter는 Node `Buffer`
 * 전역에 의존해 브라우저(WebView)에서 throw 하므로 직접 라인 스캔으로 처리. */
export function parseDocument(raw: string): ParsedDocument {
  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) {
    return { frontmatter: null, body: raw };
  }

  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
  if (!match) {
    return { frontmatter: null, body: raw };
  }

  const yamlStr = match[1] ?? "";
  const body = raw.slice(match[0].length);
  try {
    const data = yaml.load(yamlStr);
    const frontmatter =
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      Object.keys(data as object).length > 0
        ? (data as Record<string, unknown>)
        : null;
    return { frontmatter, body };
  } catch {
    return { frontmatter: null, body: raw };
  }
}

function todayISODate(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** gray-matter의 stringify는 Node `Buffer` 전역에 의존해 브라우저(WebView)에서
 * `ReferenceError: Buffer is not defined` 로 throw. js-yaml로 직접 직렬화한다. */
export function serializeDocument(doc: ParsedDocument): string {
  if (!doc.frontmatter || Object.keys(doc.frontmatter).length === 0) {
    return doc.body;
  }
  const fm = { ...doc.frontmatter };
  // `updated` 필드가 사용자에 의해 이미 frontmatter에 있을 때만 자동 갱신.
  // 없으면 새로 추가하지 않음 (사용자가 의도적으로 등록한 필드만 손댐).
  if ("updated" in fm) {
    fm.updated = todayISODate();
  }
  const yamlStr = yaml.dump(fm, { lineWidth: -1, noRefs: true });
  return `---\n${yamlStr}---\n${doc.body}`;
}
