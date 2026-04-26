# Munix — 세션 인계 노트

> 2026-04-25 세션이 매우 커진 후 컨텍스트 초기화 직전에 작성한 인계 노트.

## 한 줄 요약

`a8a8a87` (MVP) 부터 `6711a91` (suggestion key 픽스) 까지 **30+ 기능 + 5+ 버그 픽스**가 짧은 시간에 누적됨. 빌드는 모두 통과(`tsc --noEmit`, `cargo check`), 수동 검증은 일부만.

## 현재 상태 (2026-04-25 기준)

### 완료된 마일스톤
- Phase 0 환경 ✅
- Phase 1 MVP 에디터 ✅
- Phase 2 Vault + 파일 트리 ✅ (가상 스크롤 v1.1)
- Phase 3 파일 조작 + Watcher ✅
- Phase 4 에디터 UX 고급 ✅ (Callout/Toggle/Highlight/Wikilink 추가)
- Phase 5 탭·검색·팔레트 ✅ (백링크/태그/최근 추가)
- Phase 6 설정·테마·치트시트 ✅ (배포 빌드만 미완)

### Notion-grade 기능 모두 동작 (빌드 기준)
- 슬래시 메뉴 14종, 드래그 핸들, 버블 메뉴
- 표 (round-trip 안전), Callout (Obsidian-호환), Toggle, Highlight (`==text==`), Wikilink (`[[...]]`)
- 이미지 붙여넣기/드롭 (vault assets/), 코드블록 언어/복사
- 백링크, 태그, 최근, Outline 패널
- 블록 액션 (이동/복제/삭제/타입변환), 단축키 (Mod+Shift+↑↓/D), Heading 접기

### DnD 지원
- 파일 트리 (파일/폴더 이동, 700ms 자동 펼침, root drop)
- 탭 재배치 (좌/우 인디케이터)
- 에디터 블록 (Tiptap drag-handle)

### 인덱스·시스템
- FS Watcher (notify, self-write suppression)
- 자동 저장 + 충돌 다이얼로그
- vault 검색 (MiniSearch), QuickOpen, Command Palette

## 직전 세션의 주요 픽스

| 시점 | 이슈 | 커밋 |
|---|---|---|
| 마지막 | Tiptap suggestion pluginKey 충돌 → 매 transaction throw | `6711a91` |
| 직전 | 파일 트리 DnD: 파일 행 drop 버블링 + 비-md 파일 rename 차단 + 탭 DnD 위치 | `8c6436a`, `42c20f0` |
| 그 전 | 검색 결과 클릭 후 스크롤 리셋 (autofocus race) | `c98347d` |
| 그 전 | macOS trash AppleScript 권한 (-1743) → NSFileManager 전환 | `1682fb5` |

## 세션 작업 리듬 (사용자 피드백)

- **빌드 통과 = 즉시 커밋**, 수동 검증은 배치로 (메모리 `feedback_commit_cadence.md`)
- **기능당 1 커밋**, 여러 기능은 별도 커밋
- 한 기능 *내부*에서는 도구 호출 병렬 OK
- React 파일/폴더는 **kebab-case** (메모리 `feedback_file_naming.md`)
- specs/ 폴더는 **읽기 전용 문서**, 절대 vault로 열어 테스트 X (메모리 `project_munix_specs_readonly.md`)

## 검증 부채

[manual-test-checklist.md](./manual-test-checklist.md) 의 🔴 항목들이 미검증. 다음 세션의 첫 작업으로 권장.

특히 위험 영역:
- 이미지 처리 (asset protocol 첫 사용)
- Wikilink (preprocessor + custom node + suggestion + click 통합)
- 백링크/태그 인덱스 watcher 증분 갱신 정합성
- Heading fold click 좌표 검출
- 블록 액션 PM transaction 엣지 케이스

## 다음 세션 권장 시작 시퀀스

```bash
# 1. 컨텍스트 흡수
cat CLAUDE.md
cat docs/implementation-plan.md
cat docs/manual-test-checklist.md
git log --oneline -40

# 2. 앱 띄우고 검증
cd munix && pnpm tauri dev

# 3. docs/manual-test-checklist 의 🔴 항목 훑기
# 발견 버그는 docs/issues-log.md에 기록
```

이후 우선순위:
1. P0 검증 + 발견된 회귀 즉시 픽스
2. 단위 테스트 인프라 강화 + Web Worker 검색 인덱스 빌드
3. Phase 6 배포 빌드 (아이콘/CSP/각 OS 빌드/코드 서명)

---

**작성일:** 2026-04-25
**용도:** /clear 후 새 컨텍스트에서 빠르게 흡수
