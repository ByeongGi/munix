import { DND_MIME } from "./types";

export function readFileDragPaths(dataTransfer: DataTransfer): string[] {
  const raw = dataTransfer.getData(DND_MIME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { paths?: unknown };
      if (Array.isArray(parsed.paths)) {
        return parsed.paths.filter((p): p is string => typeof p === "string");
      }
    } catch {
      // WebView drag payloads can be stripped or malformed. Fall back below.
    }
  }

  const fallback = dataTransfer.getData("text/plain");
  return fallback ? [fallback] : [];
}
