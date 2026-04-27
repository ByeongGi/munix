# Refactor Architecture Plan

문서 버전: v0.1
작성일: 2026-04-28

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

1. sidebar width/collapsed localStorage 동기화를 hook으로 분리한다.
2. reveal-file-tree window event를 hook으로 분리한다.
3. modal/palette open state를 cohesive hook으로 묶는다.
4. file tree actions(create, delete, move, rename)를 app action hook으로 분리한다.
5. global shortcut dispatch를 별도 hook으로 분리한다.

## Phase 2: Workspace 경계 정리

`workspace/pane/` 폴더를 기준으로 pane 내부 UI는 한 곳에 모으고, root layout과
drag/drop 규칙은 별도 경계로 관리한다.

- `workspace/root/`: tree render, split layout, divider
- `workspace/pane/`: pane chrome, inactive editor, pane tab strip
- `workspace/dnd/`: tab drag payload, drop-zone classification, overlay

작업 순서:

1. 현재 `workspace/pane/` 이동 결과를 검토한다.
2. single pane drop target과 split pane drop target의 공통 규칙을 정리한다.
3. layout-only 파일을 `workspace/root/`로 옮긴다.
4. drag/drop helper를 `workspace/dnd/`로 옮길지 결정하고 적용한다.

## Phase 3: Tab Bar 정리

`tab-bar.tsx`와 `mini-pane-tab-strip.tsx`는 같은 탭 개념을 다루지만 store와
표현 요구가 다르다. 큰 공용 컴포넌트로 합치기보다 반복되는 계산과 payload
생성만 helper/hook으로 공유한다.

작업 순서:

1. tab drag payload 생성 helper를 공유한다.
2. reorder target index 계산을 helper로 분리한다.
3. active tab bar의 context menu action을 응집도 있게 묶는다.
4. 필요한 경우 tab row 표시 모델을 공유 타입으로 정리한다.

## Phase 4: Editor Shell 정리

active editor와 inactive pane editor의 공통 관심사는 title, frontmatter,
markdown load/save, conflict/error UI다. 저장 흐름은 회귀 위험이 크므로 작은
커밋으로 진행한다.

작업 순서:

1. title input과 properties panel의 active/inactive 재사용 가능성을 점검한다.
2. save status/error banner를 작은 컴포넌트로 분리한다.
3. markdown read/write side effect를 hook 경계로 분리한다.
4. search/tag/backlink index update 호출 위치를 명확히 이름 붙인다.

## Phase 5: Store와 렌더링 구독 정리

Zustand store 구독이 넓은 컴포넌트를 줄이고, action 이름과 반환 형태를
예측 가능하게 맞춘다.

작업 순서:

1. 컴포넌트가 raw object 대신 primitive/derived selector를 구독하도록 조정한다.
2. callback에서만 쓰는 값은 render subscription에서 제거한다.
3. slice action 이름을 domain verb 중심으로 점검한다.
4. 기존 테스트가 있는 slice는 함께 실행한다.

## 검증 체크리스트

- 각 커밋 전 `pnpm --dir munix lint`
- app/workspace/editor 큰 묶음 후 `pnpm --dir munix build`
- store/helper 변경 시 관련 Vitest 실행
- 최종 라운드 종료 시 `pnpm --dir munix lint && pnpm --dir munix build`
