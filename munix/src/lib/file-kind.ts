const IMAGE_EXTENSIONS = new Set([
  "apng",
  "avif",
  "gif",
  "jpg",
  "jpeg",
  "png",
  "svg",
  "webp",
]);

export function extensionOfPath(path: string): string {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function isMarkdownPath(path: string): boolean {
  return extensionOfPath(path) === "md";
}

export function isImagePath(path: string): boolean {
  return IMAGE_EXTENSIONS.has(extensionOfPath(path));
}

export function isOpenablePath(path: string): boolean {
  return isMarkdownPath(path) || isImagePath(path);
}
