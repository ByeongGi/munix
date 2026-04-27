import { useEffect, useState } from "react";

import {
  PaneActionsButton,
  PaneActionsMenu,
} from "@/components/workspace/pane/pane-context-menu";

type Translate = (key: string) => string;

interface PaneMenuState {
  x: number;
  y: number;
}

interface TabPaneActionsProps {
  label: string;
  t: Translate;
  onSplitRight: () => void;
  onSplitDown: () => void;
  onClosePane: () => void;
}

export function TabPaneActions({
  label,
  t,
  onSplitRight,
  onSplitDown,
  onClosePane,
}: TabPaneActionsProps) {
  const [menu, setMenu] = useState<PaneMenuState | null>(null);

  useEffect(() => {
    if (!menu) return;

    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close, { once: true });

    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [menu]);

  const runAndClose = (action: () => void) => {
    action();
    setMenu(null);
  };

  return (
    <>
      <PaneActionsButton
        label={label}
        onClick={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          setMenu({ x: rect.left, y: rect.bottom + 4 });
        }}
      />
      {menu ? (
        <PaneActionsMenu
          x={menu.x}
          y={menu.y}
          t={t}
          onSplitRight={() => runAndClose(onSplitRight)}
          onSplitDown={() => runAndClose(onSplitDown)}
          onClosePane={() => runAndClose(onClosePane)}
        />
      ) : null}
    </>
  );
}
