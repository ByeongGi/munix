# Refactor Architecture Plan

문서 버전: v0.2
작성일: 2026-04-28
최근 업데이트: 2026-04-28

## 목표

Munix 프론트엔드의 동작은 보존하면서 변경 범위를 예측 가능하게 줄인다.
이번 리팩토링은 기능 추가가 아니라 폴더링, 책임 경계, 렌더링 구독 범위, 중복
로직을 정리하는 작업이다.

## 원칙

- 한 커밋은 하나의 책임 경계를 다룬다. 파일 수가 많아도 같은 책임이면 함께
  커밋한다.
- 단순 파일 이동과 import 정리는 같은 커밋에 묶는다.
- 동작 변경 가능성이 있는 로직 추출은 파일 이동과 분리한다.
- 작은 변경은 `pnpm --dir munix lint`, 큰 구조 변경은
  `pnpm --dir munix build`까지 검증한다.
- 새 UI 텍스트를 추가할 때는 `t()`를 사용한다. 기존 하드코딩 텍스트는 해당
  파일을 만질 때 함께 정리한다.

## Phase 1: App Shell 분해

현재 `src/app.tsx`는 vault/file action, global shortcut, sidebar persistence,
modal state, workspace composition을 동시에 담당한다. 우선순위는 앱 최상위가
상태 배선과 화면 조합만 담당하도록 만드는 것이다.

- `hooks/app/`: app-level UI state와 browser event hook
- `lib/app-actions/`: vault/file mutation action helper
- `components/app-shell/`: workspace 화면 조합 컴포넌트

작업 순서:

1. [x] sidebar width/collapsed localStorage 동기화를 hook으로 분리한다.
2. [x] reveal-file-tree window event를 hook으로 분리한다.
3. [x] modal/palette open state를 cohesive hook으로 묶는다.
4. [x] file tree actions(create, delete, move, rename)를 app action hook으로 분리한다.
5. [x] global shortcut dispatch를 별도 hook으로 분리한다.

완료 메모:

- `app.tsx`의 파일/vault 액션과 shortcut/overlay 상태를 `hooks/app/*`와
  `components/app-shell/app-workspace-view.tsx`로 분리했다.
- 다음 작업에서 app shell은 우선순위 낮음. 새 기능 추가 전 import 경계와
  hook 이름만 필요 시 다듬는다.

## Phase 2: Workspace 경계 정리

`workspace/pane/` 폴더를 기준으로 pane 내부 UI는 한 곳에 모으고, root layout과
drag/drop 규칙은 별도 경계로 관리한다.

- `workspace/root/`: tree render, split layout, divider
- `workspace/pane/`: pane chrome, inactive editor, pane tab strip
- `workspace/dnd/`: tab drag payload, drop-zone classification, overlay

작업 순서:

1. [x] 현재 `workspace/pane/` 이동 결과를 검토한다.
2. [x] single pane drop target과 split pane drop target의 공통 규칙을 정리한다.
3. [x] layout-only 파일을 `workspace/root/`로 옮긴다.
4. [x] drag/drop helper를 `workspace/dnd/`로 옮길지 결정하고 적용한다.
5. [x] `pane.tsx`의 DnD 상태/이벤트를 `use-pane-drop-target`으로 분리한다.
6. [x] pane/tab context menu 상태와 액션을 `use-pane-menus`로 분리한다.
7. [x] inactive pane body 분기를 `inactive-pane-body.tsx`로 분리한다.

완료 메모:

- `pane.tsx`는 pane shell 조립 중심으로 축소됐다.
- `workspace/pane/use-pane-drop-target.ts`가 pane root drag/drop overlay와
  tab payload 처리의 현재 소유자다.
- `workspace/pane/use-pane-menus.tsx`가 pane menu와 pane-local tab context
  menu 액션의 현재 소유자다.

## Phase 3: Tab Bar 정리

`tab-bar.tsx`와 `mini-pane-tab-strip.tsx`는 같은 탭 개념을 다루지만 store와
표현 요구가 다르다. 큰 공용 컴포넌트로 합치기보다 반복되는 계산과 payload
생성만 helper/hook으로 공유한다.

작업 순서:

1. [x] tab drag payload 생성 helper를 공유한다.
2. [x] reorder target index 계산을 helper로 분리한다.
3. [x] active tab bar의 context menu action을 응집도 있게 묶는다.
4. [x] 필요한 경우 tab row 표시 모델을 공유 타입으로 정리한다.
5. [x] active tab item, empty tab item, new tab button, soft limit badge를
   작은 컴포넌트로 분리한다.
6. [x] `tab-bar.tsx`를 `components/tab/tab-bar.tsx`로 이동한다.

완료 메모:

- `components/tab/`가 full TabBar 관련 파일의 기준 폴더다.
- `use-tab-dnd-handlers`와 `tab-dnd.ts`가 active TabBar drag/reorder 규칙을
  담당한다.
- `mini-pane-tab-strip.tsx`는 아직 자체 DnD 로직을 가지고 있다. 다음 라운드에서
  active TabBar와 더 공유할지 검토 가능하다.

## Phase 4: Editor Shell 정리

active editor와 inactive pane editor의 공통 관심사는 title, frontmatter,
markdown load/save, conflict/error UI다. 저장 흐름은 회귀 위험이 크므로 작은
커밋으로 진행한다.

작업 순서:

1. [x] title input과 properties panel의 active/inactive 재사용 가능성을 점검한다.
2. [x] save status/error banner를 작은 컴포넌트로 분리한다.
3. [ ] markdown read/write side effect를 hook 경계로 분리한다.
4. [x] search/tag/backlink index update 호출 위치를 명확히 이름 붙인다.
5. [x] inactive pane rename 흐름을 `use-inactive-pane-rename`으로 분리한다.

완료 메모:

- `inactive-pane-editor-status-banner.tsx`, `inactive-pane-editor-utils.ts`,
  `inactive-pane-editor-types.ts`, `use-inactive-pane-rename.ts` 분리 완료.
- 아직 남은 큰 작업은 `inactive-pane-editor.tsx` 내부의 read/write/autosave
  루프를 hook으로 빼는 것이다. 저장 충돌 회귀 위험이 있으므로 다음 작업 때
  독립 커밋으로 진행한다.

## Phase 4.5: Palette와 Settings 폴더링

`command-palette.tsx`, `vault-switcher.tsx`, `settings-dialog.tsx`가 큰 UI
오케스트레이터였으므로 Phase 4 중간에 먼저 분리했다.

완료:

- [x] `command-palette` 명령 정의를 `use-palette-commands`와
  `palette-command-builders.ts`로 분리.
- [x] palette item 타입, item 생성, item 실행, item list 렌더링을 분리.
- [x] vault switcher item 타입, item 생성 hook, item list 렌더링을 분리.
- [x] `settings-dialog.tsx`를 `components/settings/settings-dialog.tsx`로 이동.
- [x] settings nav, controls, panels, types를 `components/settings/*`로 분리.

남은 후보:

- `palette-command-builders.ts`가 285줄로 다시 커졌다. 명령 그룹별
  builder(file/tab/sidebar/theme/workspace/vault)로 더 나눌 수 있다.
- `settings-panels.tsx`가 227줄이다. 필요하면 `general-settings-panel.tsx`,
  `editor-settings-panel.tsx`, `vault-settings-panel.tsx` 등 파일당 패널 1개로
  추가 분리한다.

## Phase 5: Store와 렌더링 구독 정리

Zustand store 구독이 넓은 컴포넌트를 줄이고, action 이름과 반환 형태를
예측 가능하게 맞춘다.

작업 순서:

1. 컴포넌트가 raw object 대신 primitive/derived selector를 구독하도록 조정한다.
2. callback에서만 쓰는 값은 render subscription에서 제거한다.
3. slice action 이름을 domain verb 중심으로 점검한다.
4. 기존 테스트가 있는 slice는 함께 실행한다.

현재 상태:

- 아직 본격 진행 전이다.
- 가장 큰 후보는 `store/slices/workspace-tree-slice.ts`(약 983줄)와
  `store/slices/tab-slice.ts`(약 408줄)다.
- store 리팩토링은 UI 리팩토링보다 회귀 위험이 크므로 관련 Vitest를 함께
  실행한다.

## 다음 작업 후보

다음 대화에서 이어갈 때 우선순위는 아래 순서로 본다.

1. **File Tree 모듈 분리**
   - 대상: `components/file-tree/file-list.tsx`,
     `components/file-tree/file-tree-inner.tsx`
   - 이유: 각각 300줄 이상이고 렌더링, selection, context menu, DnD/keyboard가
     섞여 있을 가능성이 높다.
   - 검증: `pnpm --dir munix lint`, `pnpm --dir munix build`

2. **Inactive Pane Editor autosave hook 분리**
   - 대상: `components/workspace/pane/inactive-pane-editor.tsx`
   - 이유: read/write/autosave/conflict 흐름이 아직 컴포넌트 내부에 남아 있다.
   - 주의: 저장 충돌과 rename flush 회귀 위험이 있어 단독 커밋으로 진행한다.
   - 검증: `pnpm --dir munix lint`, `pnpm --dir munix build`

3. **Palette command builder 추가 분리**
   - 대상: `components/palette/palette-command-builders.ts`
   - 이유: 명령 정의 파일이 285줄로 커졌고 그룹별 책임 분리가 쉽다.
   - 검증: `pnpm --dir munix lint`

4. **Workspace Store slice 분리 준비**
   - 대상: `store/slices/workspace-tree-slice.ts`
   - 이유: 가장 큰 파일이지만 회귀 위험이 높다.
   - 선행: 현재 테스트 구조 확인 후 helper extraction부터 진행.
   - 검증: 관련 Vitest + `pnpm --dir munix build`

## 검증 체크리스트

- 각 커밋 전 `pnpm --dir munix lint`
- app/workspace/editor 큰 묶음 후 `pnpm --dir munix build`
- store/helper 변경 시 관련 Vitest 실행
- 최종 라운드 종료 시 `pnpm --dir munix lint && pnpm --dir munix build`

## 완료된 주요 커밋

- `9ef2c60 refactor(palette): modularize commands and vault switcher`
- `e7a4f82 refactor(settings): split dialog into settings module`
- `7db033a refactor(workspace): split pane drag and menu logic`
- `3a9cf82 refactor(workspace): modularize inactive pane editor helpers`

각 커밋은 `pnpm --dir munix lint`와 `pnpm --dir munix build` 통과 후 기록했다.
Vite의 기존 dynamic/static import 및 chunk size warning은 남아 있지만 빌드 실패는
아니다.
