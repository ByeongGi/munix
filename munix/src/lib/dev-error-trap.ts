import { error as logError, warn as logWarn } from "@tauri-apps/plugin-log";

/**
 * dev 모드에서 ErrorBoundary 가 못 잡는 비동기 에러를 캐치한다.
 * - `window.error`: throw 된 미캐치 예외 (이벤트 핸들러, setTimeout 등)
 * - `unhandledrejection`: catch 되지 않은 Promise rejection
 *
 * 둘 다 plugin-log 로 파일까지 영속화 → ProseMirror 의 비동기 tr 에러처럼
 * 콘솔만 깜빡이고 사라지는 케이스를 잡기 위함.
 *
 * production 빌드에서는 호출되지 않음 (main.tsx 에서 import.meta.env.DEV 가드).
 */
export function installDevErrorTrap(): void {
  const onError = (ev: ErrorEvent): void => {
    const e =
      ev.error instanceof Error ? ev.error : new Error(String(ev.message));
    const payload = `[window.error] ${e.name}: ${e.message}\n${e.stack ?? "(no stack)"}\nat ${ev.filename}:${ev.lineno}:${ev.colno}`;
    void logError(payload).catch(() => undefined);
    console.error("[dev-trap]", e, ev);
  };

  const onRejection = (ev: PromiseRejectionEvent): void => {
    const reason = ev.reason;
    const e = reason instanceof Error ? reason : new Error(String(reason));
    const payload = `[unhandledrejection] ${e.name}: ${e.message}\n${e.stack ?? "(no stack)"}`;
    void logWarn(payload).catch(() => undefined);
    console.warn("[dev-trap]", reason);
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
}
