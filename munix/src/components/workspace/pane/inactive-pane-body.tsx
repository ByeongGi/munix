import { TerminalView } from "@/components/terminal/terminal-view";
import { isTerminalTab } from "@/store/slices/tab-slice";
import type { PaneNode } from "@/store/workspace-types";
import { EmptyPanePlaceholder } from "./empty-pane-placeholder";
import { InactivePaneEditor } from "./inactive-pane-editor";

interface InactivePaneBodyProps {
  pane: PaneNode;
  onClose: () => void;
  onNewFile: () => void;
  onQuickOpen: () => void;
}

export function InactivePaneBody({
  pane,
  onClose,
  onNewFile,
  onQuickOpen,
}: InactivePaneBodyProps) {
  const activeTab = pane.tabs.find((tab) => tab.id === pane.activeTabId);

  if (isTerminalTab(activeTab)) {
    return (
      <TerminalView
        key={activeTab.id}
        terminalTabId={activeTab.id}
        className="min-h-0 min-w-0 flex-1"
      />
    );
  }

  if (pane.tabs.length === 0 || activeTab?.path === "") {
    return (
      <EmptyPanePlaceholder
        onNewFile={onNewFile}
        onQuickOpen={onQuickOpen}
        onClose={onClose}
      />
    );
  }

  if (!activeTab?.path) return null;

  return (
    <InactivePaneEditor
      path={activeTab.path}
      titleDraft={activeTab.titleDraft}
    />
  );
}
