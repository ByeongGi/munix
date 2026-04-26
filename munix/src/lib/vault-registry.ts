/**
 * 글로벌 vault 레지스트리 (`munix.json`) 조작 헬퍼. (ADR-032)
 *
 * vault-dock-store 가 open/close/setActive 시 호출하는 작은 entry-level
 * 동기화 함수와, 부팅 시 1회 실행되는 bootstrap (자동 reopen) 을 제공한다.
 * backend 의 atomic write 가 모든 동기화를 담당한다.
 *
 * 출시 전이라 legacy `localStorage[munix:vaultHistory/lastVault]` 와의 호환은
 * 두지 않는다 (사용자 결정 2026-04-26).
 */

import { ipc, type VaultRegistry, type VaultRegistryEntry } from "@/lib/ipc";

export type { VaultRegistry, VaultRegistryEntry };

/** registry 스냅샷에서 active vault id 1개를 추린다 (혹은 null). */
export function pickActiveId(registry: VaultRegistry): string | null {
  for (const [id, entry] of Object.entries(registry.vaults)) {
    if (entry.active) return id;
  }
  return null;
}

/**
 * vault open 직후 호출 — registry 에 entry upsert.
 * backend 가 같은 path 에 대해 같은 id 반환 (idempotent), 그러므로 같은 id 로
 * ts / open / active 갱신.
 */
export async function registerVaultOpen(
  id: string,
  path: string,
  setActive: boolean,
): Promise<void> {
  try {
    const reg = await ipc.vaultRegistryLoad();
    if (setActive) {
      for (const e of Object.values(reg.vaults)) {
        e.active = false;
      }
    }
    const existing = reg.vaults[id];
    reg.vaults[id] = {
      path: existing?.path ?? path,
      ts: Date.now(),
      open: true,
      active: setActive ? true : (existing?.active ?? false),
    };
    await ipc.vaultRegistrySave(reg);
  } catch (e) {
    console.warn("[vault-registry] register open failed", e);
  }
}

/** vault 닫힘 직후 — entry 의 open=false (entry 자체는 history 로 유지). */
export async function registerVaultClose(id: string): Promise<void> {
  try {
    const reg = await ipc.vaultRegistryLoad();
    const e = reg.vaults[id];
    if (!e) return;
    e.open = false;
    e.active = false;
    await ipc.vaultRegistrySave(reg);
  } catch (e) {
    console.warn("[vault-registry] register close failed", e);
  }
}

/** active vault 변경 — 단일 active 보장 + ts 갱신. */
export async function registerVaultActive(id: string): Promise<void> {
  try {
    const reg = await ipc.vaultRegistryLoad();
    for (const [eid, entry] of Object.entries(reg.vaults)) {
      entry.active = eid === id;
    }
    const target = reg.vaults[id];
    if (target) target.ts = Date.now();
    await ipc.vaultRegistrySave(reg);
  } catch (e) {
    console.warn("[vault-registry] register active failed", e);
  }
}

/** Welcome 화면 history — closed entry 만, ts 내림차순. */
export async function listClosedVaults(): Promise<
  Array<{ id: string; entry: VaultRegistryEntry }>
> {
  try {
    const reg = await ipc.vaultRegistryLoad();
    return Object.entries(reg.vaults)
      .filter(([, e]) => !e.open)
      .map(([id, entry]) => ({ id, entry }))
      .sort((a, b) => b.entry.ts - a.entry.ts);
  } catch {
    return [];
  }
}

/**
 * 부팅 시 1회 호출. registry 로드 → `open: true` entry 모두 reopen + active 적용.
 * 호출처: main.tsx Root.
 *
 * **id 재발급 처리:** backend `VaultManager` 는 부팅마다 새 UUID 부여 (이전 세션의 id 모름).
 * 그래서 entry.id 와 backend 가 부여한 realId 가 다른 경우가 거의 항상 발생 →
 * stale entry (`entry.id`) 를 registry 에서 삭제. 결과적으로 같은 vault 가 매번
 * 새 id 로 다시 기록되지만 path 는 보존되어 자동 reopen 은 정상 동작.
 */
export async function bootstrapVaultRegistry(): Promise<void> {
  // 동적 import — circular 회피
  const { useVaultDockStore } = await import("@/store/vault-dock-store");

  let registry: VaultRegistry;
  try {
    registry = await ipc.vaultRegistryLoad();
  } catch (e) {
    console.warn("[vault-registry] load failed", e);
    return;
  }

  const toOpen = Object.entries(registry.vaults)
    .filter(([, e]) => e.open)
    .sort(([, a], [, b]) => b.ts - a.ts);

  if (toOpen.length === 0) return;

  // active 보존을 위해 path 로 추적 (id 가 부팅마다 바뀌므로)
  const desiredActivePath =
    toOpen.find(([, e]) => e.active)?.[1].path ?? toOpen[0]?.[1].path ?? null;

  // 같은 path 가 여러 entry 로 등록된 경우 첫 번째만 reopen — 중복 호출 방지
  const seenPaths = new Set<string>();
  const staleEntryIds: string[] = [];

  for (const [entryId, entry] of toOpen) {
    if (seenPaths.has(entry.path)) {
      staleEntryIds.push(entryId);
      continue;
    }
    seenPaths.add(entry.path);

    try {
      const realId = await useVaultDockStore.getState().openVault(entry.path);
      // backend 가 부여한 실제 id 와 registry entry id 가 다르면 stale
      if (realId !== entryId) {
        staleEntryIds.push(entryId);
      }
    } catch (e) {
      console.warn("[vault-registry] reopen failed", entry.path, e);
      // path 사라짐 등으로 reopen 실패 → entry 를 closed 로 옮겨 Welcome history 에
      // broken 으로 노출. open: true 그대로 두면 좀비 entry 가 되어 history 에서
      // 안 보이고 dock 에도 안 뜸.
      try {
        await registerVaultClose(entryId);
      } catch {
        // ignore
      }
    }
  }

  // stale entry 정리 — 한꺼번에
  for (const id of staleEntryIds) {
    try {
      await ipc.vaultRegistryRemove(id);
    } catch {
      // ignore
    }
  }

  // backend 진실로 dock vaults 동기화 — 중복 / 부팅 race 정리
  await useVaultDockStore.getState().refresh();

  if (desiredActivePath) {
    const dock = useVaultDockStore.getState();
    const matched = dock.vaults.find((v) => v.root === desiredActivePath);
    if (matched && dock.activeVaultId !== matched.id) {
      await dock.setActive(matched.id);
    }
  }
}
