import { ipc } from "@/lib/ipc";
import type { Tab } from "@/store/tab-store";

export async function copyTabPath(tab: Tab) {
  if (!tab.path) return;
  try {
    const abs = await ipc.absPath(tab.path);
    await ipc.copyText(abs);
  } catch (error) {
    console.error("copy tab path failed", error);
  }
}

export async function copyTabRelativePath(tab: Tab) {
  if (!tab.path) return;
  try {
    await ipc.copyText(tab.path);
  } catch (error) {
    console.error("copy tab relative path failed", error);
  }
}

export async function copyTabLink(tab: Tab) {
  if (!tab.path) return;
  try {
    const target = tab.path.replace(/\.md$/i, "");
    await ipc.copyText(`[[${target}]]`);
  } catch (error) {
    console.error("copy tab link failed", error);
  }
}

export function revealTabInFileTree(tab: Tab) {
  if (!tab.path) return;
  window.dispatchEvent(
    new CustomEvent("munix:reveal-file-tree", {
      detail: { path: tab.path },
    }),
  );
}

export async function revealTabInSystem(tab: Tab) {
  if (!tab.path) return;
  try {
    await ipc.revealInSystem(tab.path);
  } catch (error) {
    console.error("reveal tab failed", error);
  }
}
