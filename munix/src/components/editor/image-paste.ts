import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ipc } from "@/lib/ipc";

const IMAGE_MIME_RE = /^image\/(png|jpe?g|gif|webp|svg\+xml|bmp|avif)$/i;

function mimeToExt(mime: string): string | null {
  const m = mime.toLowerCase();
  if (m === "image/svg+xml") return "svg";
  if (m === "image/jpeg") return "jpg";
  const match = /^image\/([a-z]+)$/.exec(m);
  return match?.[1] ?? null;
}

async function uploadAndInsert(
  editor: Editor,
  file: File,
  coords?: { pos: number },
): Promise<void> {
  const ext = mimeToExt(file.type);
  if (!ext) return;
  const buf = new Uint8Array(await file.arrayBuffer());
  const relPath = await ipc.saveAsset(buf, ext);
  const alt = file.name.replace(/\.[^.]+$/, "");

  if (coords) {
    editor
      .chain()
      .focus()
      .insertContentAt(coords.pos, {
        type: "image",
        attrs: { src: relPath, alt },
      })
      .run();
  } else {
    editor.chain().focus().setImage({ src: relPath, alt }).run();
  }
}

/**
 * 이미지 붙여넣기/드롭을 가로채서 vault `assets/`에 저장 후 Image 노드 삽입.
 */
export const ImagePaste = Extension.create({
  name: "imagePaste",
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("imagePaste"),
        props: {
          handlePaste(_view, event) {
            const items = event.clipboardData?.items;
            if (!items) return false;
            for (const item of Array.from(items)) {
              if (item.kind === "file" && IMAGE_MIME_RE.test(item.type)) {
                const file = item.getAsFile();
                if (!file) continue;
                event.preventDefault();
                void uploadAndInsert(editor, file);
                return true;
              }
            }
            return false;
          },
          handleDrop(view, event) {
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return false;
            const images = Array.from(files).filter((f) =>
              IMAGE_MIME_RE.test(f.type),
            );
            if (images.length === 0) return false;
            event.preventDefault();

            const coords = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            void (async () => {
              for (const img of images) {
                await uploadAndInsert(
                  editor,
                  img,
                  coords ? { pos: coords.pos } : undefined,
                );
              }
            })();
            return true;
          },
        },
      }),
    ];
  },
});
