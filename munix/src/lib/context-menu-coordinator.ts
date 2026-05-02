const CONTEXT_MENU_CLOSE_EVENT = "munix:context-menu-close";

export function requestCloseContextMenus(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONTEXT_MENU_CLOSE_EVENT));
}

export function subscribeContextMenuClose(onClose: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener(CONTEXT_MENU_CLOSE_EVENT, onClose);
  return () => {
    window.removeEventListener(CONTEXT_MENU_CLOSE_EVENT, onClose);
  };
}
