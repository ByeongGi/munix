import React from "react";
import ReactDOM from "react-dom/client";
import { attachConsole } from "@tauri-apps/plugin-log";
import App from "@/app";
import "@/index.css";
import "katex/dist/katex.min.css";
import { setupI18n, resolveLang } from "@/lib/i18n";
import { useSettingsStore } from "@/store/settings-store";
import { useVaultDockStore } from "@/store/vault-dock-store";
import { ActiveVaultProvider } from "@/lib/active-vault-context";
import { bootstrapVaultRegistry } from "@/lib/vault-registry";
import { ErrorBoundary } from "@/components/error-boundary";
import { installDevErrorTrap } from "@/lib/dev-error-trap";

// Rust 쪽 log 매크로(`info!`, `error!` 등) 출력을 webview console 로 포워드.
// 실패해도 앱 부팅을 막지 않음 (browser 환경/플러그인 누락 대비).
void attachConsole().catch(() => undefined);

if (import.meta.env.DEV) {
  installDevErrorTrap();
}

// i18next 초기화 — App 렌더 전에 한 번만.
const i18n = setupI18n();

// settings-store.language 변경 시 i18next.changeLanguage() 동기.
// 'auto' 면 navigator.language 기반으로 해석.
function syncLanguage(setting: ReturnType<typeof useSettingsStore.getState>["language"]): void {
  const target = resolveLang(setting);
  if (i18n.resolvedLanguage !== target) {
    void i18n.changeLanguage(target);
  }
}

// 부트 시점 1회 동기 + 이후 store 변화 구독.
syncLanguage(useSettingsStore.getState().language);
useSettingsStore.subscribe((state, prev) => {
  if (state.language !== prev.language) {
    syncLanguage(state.language);
  }
});

/**
 * ActiveVaultProvider 의 vault id source 는 `vault-dock-store.activeVaultId`.
 * (ADR-031 Phase B-ε — dock store 가 진실의 원천. 호환 layer 인 useVaultStore 는
 * info/files 캐시만 보유하며 open/close 호출 시 dock store 에 위임.)
 */
function Root() {
  const vaultId = useVaultDockStore((s) => s.activeVaultId);

  return (
    <ActiveVaultProvider vaultId={vaultId}>
      <App />
    </ActiveVaultProvider>
  );
}

// 부팅 시 1회 — `munix.json` 로드 + legacy localStorage 마이그레이션 +
// open: true 였던 vault 자동 reopen. (ADR-032)
//
// **render 전에 await**. useEffect 안에서 fire-and-forget 으로 두면
// VaultPicker 같은 컴포넌트가 마운트되어 munix.json 을 먼저 읽어버려서
// bootstrap 이 stale entry 를 closed 로 정리하기 전 상태(open: true)를
// 본다 — 깨진 vault 가 history 에 안 보이는 원인.
async function boot(): Promise<void> {
  try {
    await bootstrapVaultRegistry();
  } catch (e) {
    console.warn("[boot] bootstrapVaultRegistry failed", e);
  }
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <ErrorBoundary scope="root">
        <Root />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}

void boot();
