import App from "@/app";
import { ErrorBoundary } from "@/components/error-boundary";
import { ActiveVaultProvider } from "@/lib/active-vault-provider";
import { useVaultDockStore } from "@/store/vault-dock-store";

export function Root() {
  const vaultId = useVaultDockStore((s) => s.activeVaultId);

  return (
    <ErrorBoundary scope="root">
      <ActiveVaultProvider vaultId={vaultId}>
        <App />
      </ActiveVaultProvider>
    </ErrorBoundary>
  );
}
