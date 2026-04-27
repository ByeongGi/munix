# Munix — 기능 상세 설계 (Specs)

> 각 기능의 구체적인 설계 문서 모음.

---

## 📚 문서 구성

| # | 문서 | 내용 | Phase | 상태 |
|---|------|------|-------|------|
| 1 | [editor-spec.md](./editor-spec.md) | Tiptap 에디터, 슬래시 메뉴, 버블 메뉴, MD 변환 | 1 | 구현 |
| 2 | [vault-spec.md](./vault-spec.md) | Rust 백엔드, FS 안전성, IPC 커맨드 | 1 | 구현 |
| 3 | [auto-save-spec.md](./auto-save-spec.md) | 자동 저장, 충돌 감지, 재시도 | 1 | 구현 |
| 4 | [file-tree-spec.md](./file-tree-spec.md) | 사이드바 트리, 파일 조작, 드래그 | 2 | 구현 |
| 5 | [keymap-spec.md](./keymap-spec.md) | 전체 단축키 맵, 컨텍스트 격리 | 2 | 구현 |
| 6 | [search-spec.md](./search-spec.md) | Quick Open, 전문 검색, 팔레트 | 5 | 구현 |
| 7 | [settings-spec.md](./settings-spec.md) | 설정 스키마, 저장, UI | 6 | 구현 |
| 8 | [theme-spec.md](./theme-spec.md) | 컬러 토큰, 다크모드, 타이포 | 6 | 구현 |
| 9 | [plugin-spec.md](./plugin-spec.md) 🆕 | Extism WASM 플러그인 시스템 (capability 기반) | 7+ | **proposed** |
| 10 | [terminal-spec.md](./terminal-spec.md) 🆕 | 터미널 (플러그인 1호, xterm.js + portable-pty) | 7+ | **proposed** |
| 11 | [cli-spec.md](./cli-spec.md) 🆕 | CLI + URI scheme (`munix://`) — 3계층 출시 | 6/7+ | **proposed** |
| 12 | [i18n-spec.md](./i18n-spec.md) | 다국어 지원 (i18next 26 + react-i18next 17, 영/한 + 점진적) | 6/7+ | **구현 (Phase A)** |
| 13 | [workspace-split-spec.md](./workspace-split-spec.md) 🆕 | Obsidian-style 분할 패널, pane별 탭, 탭 DnD split | 7+ | **proposed** |
| 14 | [vault-trust-spec.md](./vault-trust-spec.md) 🆕 | Vault 단위 신뢰 모델, 시스템 연동 권한 요청 | 6/7+ | **partial** |
| 15 | [multi-vault-spec.md](./multi-vault-spec.md) 🆕 | 멀티 vault 워크스페이스 (cmux 스타일 좌측 세로 탭, 탭 → 새 창 승격) | 5/6 | **proposed** |

---

## 🎯 MVP (Phase 1)

MVP 달성을 위한 최소 스펙 세트:

1. **[editor-spec.md](./editor-spec.md)** — 섹션 1-6, 11-13
2. **[vault-spec.md](./vault-spec.md)** — 섹션 1-6
3. **[auto-save-spec.md](./auto-save-spec.md)** — 섹션 1-7

---

## 📦 스펙 문서 작성 규칙

각 스펙은 다음 공통 섹션을 포함:

1. **목적** — 왜 이 기능이 존재하는가
2. **요구사항** — 기능/비기능 (P0/P1/P2 우선순위)
3. **데이터 모델** — TypeScript/Rust 타입 정의
4. **API/인터페이스** — 커맨드, 훅, 프롭
5. **UI/UX 플로우** — 상세 동작과 시각화
6. **에러 처리** — 실패 경로
7. **엣지 케이스** — 잘 잊는 예외
8. **테스트 케이스** — 검증 포인트
9. **오픈 이슈** — 아직 결정 못 한 것

---

## 🔗 의존 관계

```
editor-spec ──┬──> auto-save-spec
              └──> keymap-spec
                         │
vault-spec ───┬──────────┤
              ├──> file-tree-spec
              └──> auto-save-spec

search-spec ─────> vault-spec, file-tree-spec
settings-spec ───> theme-spec, keymap-spec
theme-spec ──────> (독립)

# 🆕 v1.0 후반 ~ v1.1 (proposed)
plugin-spec ──┬──> terminal-spec
              └──> (다른 플러그인들 — 향후)
                         │
                         └──> theme-spec (xterm 테마 매핑)

cli-spec ────> vault-spec (path validation)

workspace-split-spec ──┬──> editor-spec
                       ├──> keymap-spec
                       └──> settings-spec (workspace persist)

vault-trust-spec ──┬──> vault-spec
                   ├──> file-tree-spec (reveal in system)
                   ├──> plugin-spec
                   └──> terminal-spec

# 🆕 v1.5 (proposed — ADR-031)
multi-vault-spec ──┬──> vault-spec (VaultManager 도입)
                   ├──> keymap-spec (⌘1~9, ⌘T, ⌘W 등)
                   ├──> settings-spec (글로벌 vs vault override)
                   ├──> search-spec (vault scope 명시)
                   ├──> cli-spec (URI vault 라우팅)
                   ├──> workspace-split-spec (vault × split 조합)
                   └──> vault-trust-spec (새 vault 신뢰 prompt)
```

---

## 📅 버전

- **초안 작성일:** 2026-04-25
- **모든 스펙 버전:** v0.1
- **최근 추가 (2026-04-25):** plugin-spec / terminal-spec / cli-spec (모두 proposed — [ADR-022](../decisions.md#adr-022-플러그인-시스템-extism-wasm), [ADR-023](../decisions.md#adr-023-터미널-플러그인-1호), [ADR-024](../decisions.md#adr-024-cli--uri-scheme-munix))
- **최근 추가 (2026-04-26):** workspace-split-spec (proposed — Obsidian-style pane split + tab DnD)
- **최근 추가 (2026-04-26):** vault-trust-spec (partial — 시스템 파일 관리자 reveal에 초기 적용)
- **최근 추가 (2026-04-26):** multi-vault-spec (proposed — [ADR-031](../decisions.md#adr-031-멀티-vault-워크스페이스-cmux-스타일-좌측-세로-탭) cmux 스타일 좌측 세로 vault 탭 + 탭 → 새 창 승격, [ADR-004](../decisions.md#adr-004-단일-vault-방식) supersede)

---

## ✅ 다음 단계

- [ ] 각 스펙에 대한 피드백 수렴
- [ ] Phase 1 스펙 확정 → 구현 착수
- [ ] Phase 0 (환경 세팅) 완료
- [ ] Phase 1 착수 전 오픈 이슈 해결
