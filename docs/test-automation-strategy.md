# Munix — 테스트 자동화 전략

> 최종 목표: `docs/manual-test-checklist.md`의 모든 회귀 검증을 자동화 테스트로 치환한다.
> 사람이 직접 확인하는 테스트는 출시 전 탐색 테스트와 OS/스토어 배포 확인에만 남긴다.

---

## 원칙

1. **수동 회귀 테스트 금지**
   - 새 기능의 완료 조건은 자동화 테스트다.
   - 수동 체크리스트 항목은 자동화 전환 대기열로만 취급한다.

2. **Tauri 의존성은 경계 뒤로 숨긴다**
   - React 렌더링은 mock IPC + browser harness로 검증한다.
   - Tauri WebView, OS dialog, file association, native window 동작만 native E2E로 올린다.

3. **문서 체크리스트는 테스트 매트릭스로 전환한다**
   - 기능 스펙의 "테스트 케이스"는 다음 중 하나의 자동화 레이어를 명시해야 한다.
   - 자동화가 불가능한 항목은 사유와 만료 시점을 적는다.

4. **회귀는 빠른 테스트부터 막는다**
   - 순수 로직은 Vitest/Rust unit에서 잡는다.
   - 렌더링과 주요 사용자 플로우는 Playwright browser harness에서 잡는다.
   - native-only 동작은 별도 Tauri driver suite로 격리한다.

---

## 테스트 레이어

| 레이어                | 목적                                        | 대상                                 | 명령                      |
| --------------------- | ------------------------------------------- | ------------------------------------ | ------------------------- |
| TypeScript unit       | 순수 로직, store, hook, parser              | `src/**/*.test.ts`                   | `pnpm test`               |
| React render          | Tauri 없이 실제 앱 트리 렌더                | `src/**/*.render.test.tsx`           | `pnpm test`               |
| Browser E2E           | 실제 브라우저 레이아웃/interaction          | `e2e/*.spec.ts`, `test-harness.html` | `pnpm test:render`        |
| Rust unit/integration | vault FS, path safety, settings, IPC domain | `src-tauri`                          | `pnpm test:rust`          |
| Native Tauri E2E      | WebView/native shell/OS integration         | future `e2e-native`                  | future `pnpm test:native` |
| Performance           | 파일 수, 검색, 렌더 budget                  | future perf specs                    | future `pnpm test:perf`   |
| Visual regression     | 주요 화면 screenshot diff                   | future visual specs                  | future `pnpm test:visual` |

현재 자동화 기반은 `mock-ipc`, Vitest setup, browser render harness, Playwright render suite까지 마련되어 있다. 다음 단계는 기존 수동 체크리스트를 위 레이어로 순차 이전하는 것이다.

---

## 수동 체크리스트 전환 매핑

| 수동 섹션            | 자동화 타깃                                                       | 우선순위 |
| -------------------- | ----------------------------------------------------------------- | -------- |
| 0. 환경 · 부팅       | Browser E2E + Native Tauri E2E                                    | P0       |
| 0a. 멀티 vault       | Store unit + Browser E2E + Native Tauri E2E                       | P0       |
| 1. Vault & 파일 트리 | Vitest component + Browser E2E                                    | P0       |
| 2. 파일 CRUD         | Rust unit + Store unit + Browser E2E                              | P0       |
| 4. 탭 시스템         | Store unit + Browser E2E                                          | P0       |
| 7. FS Watcher        | Rust integration + synthetic event unit + Native E2E              | P0       |
| 8. 검색              | Search unit + Browser E2E + perf                                  | P0       |
| 9. Palette/Settings  | Unit + Browser E2E                                                | P0       |
| 10-20. 에디터 기능   | Markdown golden tests + Tiptap command tests + Browser E2E        | P0/P1    |
| 21-23. 사이드바      | Component unit + Browser E2E                                      | P1       |
| 24. 테마             | Unit + Browser E2E visual smoke                                   | P1       |
| 25. 알림/에러        | Unit + Browser E2E                                                | P1       |
| 25.4-25.5 각주/수식  | Markdown golden tests + Browser E2E                               | P1       |
| 26. Obsidian 호환성  | Golden fixture round-trip + optional external compatibility check | P0       |

---

## 완료 기준

기능 PR은 다음 조건을 만족해야 한다.

- `pnpm lint`
- `pnpm test`
- `pnpm test:render`
- `pnpm build`
- `pnpm test:rust`
- `pnpm lint:rust`
- 수동 체크리스트 항목을 건드렸다면 자동화 테스트를 추가하거나, `docs/manual-test-checklist.md`에 남은 사유를 명시한다.

출시 후보는 추가로 다음 조건을 만족해야 한다.

- `pnpm test:manual-debt` 결과를 확인하고 남은 P0 수동 항목이 없어야 한다.
- native-only 항목은 `test:native` 또는 release checklist의 OS별 검증으로 이동되어 있어야 한다.
- Obsidian 호환성은 fixture round-trip 테스트로 검증되어야 한다.

---

## 이전 순서

1. **P0 사용자 여정**
   - 첫 실행, vault open/reopen, 깨진 recent vault 표시
   - 파일 열기, 탭 생성/닫기, basic search, command palette

2. **데이터 손실 방지**
   - auto-save debounce/flush
   - conflict detection
   - rename/create/delete/move path validation
   - Obsidian markdown round-trip

3. **에디터 고위험 기능**
   - frontmatter/properties
   - wikilink/callout/highlight/table/image/code block
   - title rename and watcher sync

4. **Native-only**
   - folder picker, trust prompt, file reveal, clipboard, Tauri window controls
   - OS별 packaged build smoke

5. **성능/시각 회귀**
   - 1k/10k files tree/search budget
   - tab switch and editor mount budget
   - core screens screenshot diff

---

## 새 테스트 작성 규칙

- IPC가 필요한 React 테스트는 `createMockIpcClient()`를 사용한다.
- Tauri API를 직접 import해야 하는 코드라면 먼저 `src/lib/tauri-*.ts` 경계로 감싼다.
- Playwright render test는 `test-harness.html` 시나리오를 추가해서 앱의 실제 React tree를 사용한다.
- 마크다운 호환성은 snapshot보다 fixture input/output golden test를 우선한다.
- 성능 테스트는 "빠르다"가 아니라 숫자 budget을 둔다.
