/**
 * EmptyPanePlaceholder — vault 는 있지만 pane 의 active tab 이 없을 때 보여주는
 * 가운데 액션 페이지. (workspace-split-spec §5.1)
 *
 * 단일 pane 모드 (workspaceTree===null) 와 split tree 모드의 빈 pane 모두에서
 * 동일하게 사용된다.
 */

import { useTranslation } from "react-i18next";

interface EmptyPanePlaceholderProps {
  onNewFile: () => void;
  onQuickOpen: () => void;
  onClose: () => void;
  /** 단일 pane 만 남았을 때 닫기 버튼 비활성화 (no-op fallback). */
  closeDisabled?: boolean;
}

export function EmptyPanePlaceholder({
  onNewFile,
  onQuickOpen,
  onClose,
  closeDisabled = false,
}: EmptyPanePlaceholderProps) {
  const { t } = useTranslation("app");

  return (
    <div className="flex flex-1 items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="flex flex-col items-center gap-4 text-sm">
        <button
          type="button"
          onClick={onNewFile}
          className="text-[var(--color-accent)] hover:underline"
        >
          {t("emptyPane.newFile")}
        </button>
        <button
          type="button"
          onClick={onQuickOpen}
          className="text-[var(--color-accent)] hover:underline"
        >
          {t("emptyPane.quickOpen")}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={closeDisabled}
          className="text-[var(--color-accent)] hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
        >
          {t("emptyPane.close")}
        </button>
      </div>
    </div>
  );
}
