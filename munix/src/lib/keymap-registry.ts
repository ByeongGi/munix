/**
 * Keymap 레지스트리 — 단축키 명령들의 단일 진실 원천.
 *
 * 모든 단축키 명령은 여기에 등록된다. 각 명령은:
 * - `id` — 안정적인 키 ("global.save")
 * - `defaultKey` — 정규화된 키 문자열 ("mod+s")
 * - `scope` — 등록 위치 (global / editor / tree / palette / search)
 * - `group` — 영문 group ID. 표시 라벨은 i18n 번역키
 *   `settings:shortcuts.groups.<group>` 으로 lookup
 * - `editable` — v1.1: global 만 customizable, 나머지는 cheatsheet 표시 전용
 *
 * **i18n**: 사용자에게 보여줄 description 은 entry 자체에 두지 않고
 * `settings:shortcuts.commands.<id>.description` 키로 번역 파일에서 lookup 한다.
 * (`public/locales/{en,ko}/settings.json` 참조)
 *
 * 기존에 흩어진 핸들러는 점진적으로 `useEffectiveKeymap()` 으로 lookup 하도록
 * 통합 (app.tsx, editor-view.tsx). Tiptap addKeyboardShortcuts 로 등록된 것은
 * 현재 customization 대상에서 제외 (v1.2+ 후속).
 */

export type KeymapScope = "global" | "editor" | "tree" | "palette" | "search";

export interface KeymapEntry {
  /** 안정적인 식별자. 명령 이름 변경 시에도 유지. */
  id: string;
  /** 기본 키 — 정규화된 형태 ("mod+shift+k"). modifier-only main 은 없음. */
  defaultKey: string;
  /** 단축키가 활성화되는 컨텍스트. */
  scope: KeymapScope;
  /**
   * 치트시트 그룹핑 ID (영문). 표시 라벨은 i18n 으로 lookup —
   * `t('settings:shortcuts.groups.<group>')`. 동일 group 끼리 묶인다.
   */
  group: string;
  /**
   * v1.1 사용자 재정의 허용 여부.
   * - true: 설정 다이얼로그에서 변경 가능
   * - false: cheatsheet 에 표시만 (Tiptap 내부 단축키 등)
   */
  editable: boolean;
}

/**
 * 레지스트리 — 등록 순서가 cheatsheet 표시 순서가 된다.
 *
 * **scope 별 처리:**
 * - `global` — `app.tsx` 의 window keydown 리스너에서 lookup
 * - `editor` — Tiptap `addKeyboardShortcuts()` 또는 editor-view 의 window keydown
 * - `tree` — file-tree/file-list 의 onKeyDown
 * - `palette` / `search` — 모달 내부 onKeyDown
 *
 * 현재(v1.1.0)는 `global` scope 만 사용자 재정의 가능. 나머지는 cheatsheet 전용.
 */
export const KEYMAP_REGISTRY: KeymapEntry[] = [
  // ── 파일 ────────────────────────────────────────────────
  {
    id: "global.newFile",
    defaultKey: "mod+t",
    scope: "global",
    group: "file",
    editable: true,
  },
  {
    id: "global.save",
    defaultKey: "mod+s",
    scope: "global",
    group: "file",
    editable: true,
  },
  {
    id: "global.closeTab",
    defaultKey: "mod+w",
    scope: "global",
    group: "file",
    editable: true,
  },
  {
    id: "global.closeAllTabs",
    defaultKey: "mod+shift+w",
    scope: "global",
    group: "file",
    editable: true,
  },
  {
    id: "global.quickOpen",
    defaultKey: "mod+p",
    scope: "global",
    group: "file",
    editable: true,
  },

  // ── 네비게이션 ──────────────────────────────────────────
  {
    id: "global.commandPalette",
    defaultKey: "mod+k",
    scope: "global",
    group: "navigation",
    editable: true,
  },
  {
    id: "global.searchInVault",
    defaultKey: "mod+shift+f",
    scope: "global",
    group: "navigation",
    editable: true,
  },
  {
    id: "global.nextTab",
    defaultKey: "mod+shift+]",
    scope: "global",
    group: "navigation",
    editable: true,
  },
  {
    id: "global.prevTab",
    defaultKey: "mod+shift+[",
    scope: "global",
    group: "navigation",
    editable: true,
  },

  // ── 도움 ────────────────────────────────────────────────
  {
    id: "global.shortcuts",
    defaultKey: "mod+/",
    scope: "global",
    group: "help",
    editable: true,
  },
  {
    id: "global.settings",
    defaultKey: "mod+,",
    scope: "global",
    group: "help",
    editable: true,
  },

  // ── 검색 (에디터 내부) ──────────────────────────────────
  {
    id: "editor.findInFile",
    defaultKey: "mod+f",
    scope: "editor",
    group: "search",
    editable: true,
  },

  // ── 에디터 — Tiptap 의 starterKit / 확장 (cheatsheet 표시 전용) ────────
  {
    id: "editor.bold",
    defaultKey: "mod+b",
    scope: "editor",
    group: "editor",
    editable: false,
  },
  {
    id: "editor.italic",
    defaultKey: "mod+i",
    scope: "editor",
    group: "editor",
    editable: false,
  },
  {
    id: "editor.strikethrough",
    defaultKey: "mod+shift+x",
    scope: "editor",
    group: "editor",
    editable: false,
  },
  {
    id: "editor.inlineCode",
    defaultKey: "mod+e",
    scope: "editor",
    group: "editor",
    editable: false,
  },
  {
    id: "editor.toggleTaskChecked",
    defaultKey: "mod+enter",
    scope: "editor",
    group: "editor",
    editable: false,
  },
  {
    id: "editor.undo",
    defaultKey: "mod+z",
    scope: "editor",
    group: "editor",
    editable: false,
  },
  {
    id: "editor.redo",
    defaultKey: "mod+shift+z",
    scope: "editor",
    group: "editor",
    editable: false,
  },

  // ── 블록 조작 (BlockShortcuts 확장) ─────────────────────
  {
    id: "editor.moveBlockUp",
    defaultKey: "mod+shift+arrowup",
    scope: "editor",
    group: "block",
    editable: false,
  },
  {
    id: "editor.moveBlockDown",
    defaultKey: "mod+shift+arrowdown",
    scope: "editor",
    group: "block",
    editable: false,
  },
  {
    id: "editor.duplicateBlock",
    defaultKey: "mod+d",
    scope: "editor",
    group: "block",
    editable: false,
  },
  {
    id: "editor.deleteBlock",
    defaultKey: "mod+shift+backspace",
    scope: "editor",
    group: "block",
    editable: false,
  },
  {
    id: "editor.selectBlock",
    defaultKey: "mod+shift+a",
    scope: "editor",
    group: "block",
    editable: false,
  },

  // ── 파일 트리 ───────────────────────────────────────────
  {
    id: "tree.rename",
    defaultKey: "f2",
    scope: "tree",
    group: "fileTree",
    editable: false,
  },

  // ── Vault (ADR-031, multi-vault-spec §7) ────────────────
  // 파일 탭 단축키와 충돌 회피 위해 `mod+alt` 변형 사용.
  {
    id: "global.openVault",
    defaultKey: "mod+shift+n",
    scope: "global",
    group: "vault",
    editable: true,
  },
  {
    id: "global.closeVault",
    defaultKey: "mod+alt+w",
    scope: "global",
    group: "vault",
    editable: true,
  },
  {
    id: "global.nextVault",
    defaultKey: "mod+alt+]",
    scope: "global",
    group: "vault",
    editable: true,
  },
  {
    id: "global.prevVault",
    defaultKey: "mod+alt+[",
    scope: "global",
    group: "vault",
    editable: true,
  },
  {
    id: "global.toggleVaultDock",
    defaultKey: "mod+alt+b",
    scope: "global",
    group: "vault",
    editable: true,
  },
  {
    id: "global.vaultSwitcher",
    defaultKey: "mod+shift+o",
    scope: "global",
    group: "vault",
    editable: true,
  },
  // 동적인 mod+alt+1~9 (vault 탭 점프) 는 별도 ID 로 등록하지 않고 cheatsheet 에서만 표기.

  // ── 탭 (1~9) ────────────────────────────────────────────
  // 동적인 1~9 키는 별도 ID 로 등록하지 않고 cheatsheet 에서만 표기.

  // ── Workspace Split (workspace-split-spec §10) ──────────
  {
    id: "workspace.splitRight",
    defaultKey: "mod+\\",
    scope: "global",
    group: "workspace",
    editable: true,
  },
  {
    id: "workspace.splitDown",
    defaultKey: "mod+shift+\\",
    scope: "global",
    group: "workspace",
    editable: true,
  },
  {
    id: "workspace.closePane",
    defaultKey: "mod+alt+shift+w",
    scope: "global",
    group: "workspace",
    editable: true,
  },
  {
    id: "workspace.moveTabRight",
    defaultKey: "mod+alt+arrowright",
    scope: "global",
    group: "workspace",
    editable: true,
  },
  {
    id: "workspace.moveTabLeft",
    defaultKey: "mod+alt+arrowleft",
    scope: "global",
    group: "workspace",
    editable: true,
  },
];

/** id → entry 빠른 조회용 인덱스. */
const BY_ID: Map<string, KeymapEntry> = new Map(
  KEYMAP_REGISTRY.map((e) => [e.id, e]),
);

export function getKeymapEntry(id: string): KeymapEntry | undefined {
  return BY_ID.get(id);
}

/** 사용자 customization 가능한 entry 만 필터. */
export function getEditableEntries(): KeymapEntry[] {
  return KEYMAP_REGISTRY.filter((e) => e.editable);
}

/** group ID 별로 묶인 cheatsheet 데이터. 표시 순서는 등록 순서 보존. */
export function groupedRegistry(): Array<{
  group: string;
  items: KeymapEntry[];
}> {
  const groups: Array<{ group: string; items: KeymapEntry[] }> = [];
  for (const e of KEYMAP_REGISTRY) {
    let bucket = groups.find((g) => g.group === e.group);
    if (!bucket) {
      bucket = { group: e.group, items: [] };
      groups.push(bucket);
    }
    bucket.items.push(e);
  }
  return groups;
}
