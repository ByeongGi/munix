import { Component, type ErrorInfo, type ReactNode } from "react";
import { error as logError } from "@tauri-apps/plugin-log";

type Props = {
  children: ReactNode;
  /** 식별자 — 어느 boundary가 잡았는지 로그/UI 에 표시. */
  scope: string;
  /** 작은 영역(panel 등) 용 inline 모드. 기본 false = 전체 화면. */
  inline?: boolean;
  /** 사용자가 "다시 시도" 누르면 호출 — 기본 동작은 boundary 자체 reset. */
  onReset?: () => void;
};

type State = {
  error: Error | null;
  componentStack: string | null;
};

const isDev = import.meta.env.DEV;

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? null });
    const payload = [
      `[boundary:${this.props.scope}]`,
      error.name,
      error.message,
      "\n--- stack ---\n",
      error.stack ?? "(no stack)",
      "\n--- componentStack ---\n",
      info.componentStack ?? "(no componentStack)",
    ].join(" ");
    // tauri-plugin-log → stdout + LogDir + webview 동시 기록.
    void logError(payload).catch(() => {
      // plugin-log 가 죽었더라도 console 에는 남도록.
      console.error(payload);
    });
    console.error(`[boundary:${this.props.scope}]`, error, info);
  }

  reset = (): void => {
    this.setState({ error: null, componentStack: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    const wrapClass = this.props.inline
      ? "m-2 rounded border border-red-500/40 bg-red-500/5 p-3 text-xs"
      : "flex h-full w-full items-start justify-center overflow-auto bg-[var(--color-bg-primary)] p-8 text-sm";

    return (
      <div className={wrapClass} role="alert">
        <div className="flex w-full max-w-3xl flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wide text-red-500">
              boundary:{this.props.scope}
            </span>
          </div>
          <div className="font-mono text-sm font-semibold text-red-400">
            {error.name}: {error.message}
          </div>
          {isDev && error.stack && (
            <details open className="text-xs">
              <summary className="cursor-pointer text-[var(--color-text-tertiary)]">
                stack
              </summary>
              <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-[var(--color-bg-secondary)] p-2 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                {error.stack}
              </pre>
            </details>
          )}
          {isDev && componentStack && (
            <details className="text-xs">
              <summary className="cursor-pointer text-[var(--color-text-tertiary)]">
                componentStack
              </summary>
              <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-[var(--color-bg-secondary)] p-2 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                {componentStack}
              </pre>
            </details>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="rounded border border-[var(--color-border-primary)] px-3 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
            >
              retry
            </button>
            {!this.props.inline && (
              <button
                type="button"
                onClick={() => location.reload()}
                className="rounded border border-[var(--color-border-primary)] px-3 py-1 text-xs hover:bg-[var(--color-bg-secondary)]"
              >
                reload window
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
