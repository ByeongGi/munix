import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import {
  eventToKeymap,
  formatKeymap,
  isCompleteKeymap,
} from "@/lib/keymap-format";

interface KeyCaptureProps {
  /** 입력 시작 시점에 표시할 현재 키 (정규화된 형태). */
  initial?: string;
  onCancel: () => void;
  onSubmit: (token: string) => void;
  /**
   * "(modifier 없는 단일 키)" 도 허용할지 — 기본 false. global scope 단축키에선
   * modifier 없는 단일 알파벳/숫자는 입력 충돌이 너무 많아 막는다. F1~F12 와
   * 화살표/Enter/Esc 는 항상 허용.
   */
  allowBareKey?: boolean;
}

const BARE_KEY_ALLOWLIST = new Set([
  "escape",
  "enter",
  "tab",
  "backspace",
  "delete",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "f1",
  "f2",
  "f3",
  "f4",
  "f5",
  "f6",
  "f7",
  "f8",
  "f9",
  "f10",
  "f11",
  "f12",
]);

/**
 * 키 캡처 위젯. 외부 div 가 포커스를 잡고 keydown 을 캡처한다.
 *
 * UX:
 * - 마운트 즉시 자동 포커스 + "키를 누르세요" 표시
 * - modifier 만 누른 상태도 visual feedback 으로 보여줌
 * - main key 까지 도달하면 onSubmit 호출
 * - Esc → onCancel (단, modifier 가 함께 눌려있다면 esc 는 main key 로 인정)
 */
export function KeyCapture({
  initial,
  onCancel,
  onSubmit,
  allowBareKey = false,
}: KeyCaptureProps) {
  const { t } = useTranslation("app");
  const [pending, setPending] = useState<string | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // browser 의 brower-defined shortcut (Cmd+R 새로고침 등) 도 일단 가로챔.
      e.preventDefault();
      e.stopPropagation();

      // modifier 만 → 시각 피드백을 위해 임시 표시
      if (
        e.key === "Meta" ||
        e.key === "Control" ||
        e.key === "Alt" ||
        e.key === "Shift"
      ) {
        setPending(buildModifierPreview(e));
        setError(null);
        return;
      }

      // Escape 단독 → 취소.
      if (e.key === "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        onCancel();
        return;
      }

      const token = eventToKeymap(e.nativeEvent);
      if (!token || !isCompleteKeymap(token)) {
        setError(t("keyCapture.errorInvalidCombo"));
        return;
      }

      // main key 가 modifier 없이 alphanumeric 1글자면 거부 (allowBareKey === false).
      if (!allowBareKey) {
        const hasModifier = e.metaKey || e.ctrlKey || e.altKey;
        const isAllowedBare = BARE_KEY_ALLOWLIST.has(extractMainKey(token));
        if (!hasModifier && !isAllowedBare) {
          setError(t("keyCapture.errorNeedsModifier"));
          setPending(token);
          return;
        }
      }

      onSubmit(token);
    },
    [t, onCancel, onSubmit, allowBareKey],
  );

  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // modifier 를 떼면 preview 도 초기화 (사용자가 modifier 만 토글하다가 안 누르고 떼는 경우)
    if (
      e.key === "Meta" ||
      e.key === "Control" ||
      e.key === "Alt" ||
      e.key === "Shift"
    ) {
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        setPending(null);
      } else {
        setPending(buildModifierPreview(e));
      }
    }
  }, []);

  const display = pending ? formatKeymap(pending) : t("keyCapture.prompt");

  return (
    <div
      ref={ref}
      role="textbox"
      aria-label={t("keyCapture.ariaLabel")}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={onCancel}
      className={cn(
        "flex min-h-[28px] min-w-[120px] items-center justify-center rounded border px-2 py-0.5",
        "border-[var(--color-accent)] bg-[var(--color-bg-tertiary)] outline-none",
        "font-mono text-[11px] text-[var(--color-text-primary)]",
        "ring-2 ring-[var(--color-accent)]/40",
      )}
    >
      <span>{display}</span>
      {error && (
        <span className="ml-2 text-[10px] text-[var(--color-text-tertiary)]">
          ({error})
        </span>
      )}
    </div>
  );
}

function buildModifierPreview(e: React.KeyboardEvent<HTMLDivElement>): string {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("mod");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  parts.push("…");
  return parts.join("+");
}

function extractMainKey(token: string): string {
  const parts = token.split("+");
  return parts[parts.length - 1] ?? "";
}
