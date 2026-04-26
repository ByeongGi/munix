/**
 * 효과적 keymap (registry + 사용자 override) 을 조회하는 훅.
 *
 * - `useEffectiveKeymap()` — `id → 정규화된 키 문자열` 의 Map 을 돌려준다.
 * - `useKeymapMatcher()` — `KeyboardEvent` → `id` 또는 `null`. 핸들러에서
 *   switch(id) 로 분기하기 위한 thin matcher.
 *
 * settings-store 의 `keymapOverrides` 를 구독하므로 override 변경 즉시 반영.
 */

import { useMemo } from "react";
import { useSettingsStore } from "@/store/settings-store";
import {
  KEYMAP_REGISTRY,
  type KeymapEntry,
  type KeymapScope,
} from "@/lib/keymap-registry";
import { eventToKeymap, normalizeKeymap } from "@/lib/keymap-format";

/** id → 정규화된 키 문자열. override 가 있으면 덮어씀, 빈 문자열은 "무효화" 의미. */
export function useEffectiveKeymap(): Map<string, string> {
  const overrides = useSettingsStore((s) => s.keymapOverrides);
  return useMemo(() => buildEffectiveKeymap(overrides), [overrides]);
}

export function buildEffectiveKeymap(
  overrides: Record<string, string>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of KEYMAP_REGISTRY) {
    const ov = overrides[e.id];
    if (ov === undefined) {
      out.set(e.id, e.defaultKey);
    } else if (ov === "") {
      // 빈 문자열 = 비활성화 (UI 에서 명시적으로 지원)
      // (현재 설정 UI 는 비활성화를 노출하지 않으므로 사실상 미사용)
      out.set(e.id, "");
    } else {
      const normalized = normalizeKeymap(ov);
      out.set(e.id, normalized ?? e.defaultKey);
    }
  }
  return out;
}

/**
 * KeyboardEvent → 매칭되는 entry id (지정 scope 만). 매칭 없으면 null.
 *
 * 사용 패턴:
 * ```
 * const match = useKeymapMatcher("global");
 * useEffect(() => {
 *   const onKeyDown = (e) => {
 *     const id = match(e);
 *     if (!id) return;
 *     e.preventDefault();
 *     switch (id) { ... }
 *   };
 *   ...
 * }, [match]);
 * ```
 */
export function useKeymapMatcher(scope: KeymapScope) {
  const effective = useEffectiveKeymap();
  return useMemo(() => {
    // scope 별 후보 entry 만 추려 token → id 매핑.
    const tokenToId = new Map<string, string>();
    for (const e of KEYMAP_REGISTRY) {
      if (e.scope !== scope) continue;
      const key = effective.get(e.id);
      if (!key) continue;
      tokenToId.set(key, e.id);
    }

    return (event: KeyboardEvent): string | null => {
      const token = eventToKeymap(event);
      if (!token) return null;
      return tokenToId.get(token) ?? null;
    };
  }, [effective, scope]);
}

/**
 * 충돌 감지 — 같은 scope 에서 같은 키가 둘 이상 entry 에 매핑되어 있는지 검사.
 * `editable` 만 검사 (pane-local Tiptap 단축키는 의도적 중복 가능 — context 격리).
 */
export interface KeymapConflict {
  key: string;
  ids: string[];
}

export function findConflicts(
  overrides: Record<string, string>,
): KeymapConflict[] {
  const effective = buildEffectiveKeymap(overrides);
  // scope+key 조합으로 그룹핑. editable 이 아닌 entry 는 제외.
  const groups = new Map<string, string[]>();
  for (const e of KEYMAP_REGISTRY) {
    if (!e.editable) continue;
    const key = effective.get(e.id);
    if (!key) continue;
    const compositeKey = `${e.scope}::${key}`;
    const arr = groups.get(compositeKey) ?? [];
    arr.push(e.id);
    groups.set(compositeKey, arr);
  }

  const conflicts: KeymapConflict[] = [];
  for (const [composite, ids] of groups) {
    if (ids.length > 1) {
      const key = composite.split("::")[1] ?? "";
      conflicts.push({ key, ids });
    }
  }
  return conflicts;
}

export type { KeymapEntry };
