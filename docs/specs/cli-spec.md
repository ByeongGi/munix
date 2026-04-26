# CLI + URI scheme 상세 설계 — Munix

> 상태: **초안 (proposed)**. [ADR-024](../decisions.md#adr-024-cli--uri-scheme-munix) 채택 후 확정.
> 옵시디언 URI scheme 패턴 + 옵시디언이 안 가진 풍성한 CLI를 단계적 출시.

---

## 1. 목적

- 셸/스크립트/외부 도구에서 Munix 트리거 (옵시디언 URI scheme 패턴)
- 빠른 노트 열기/생성 워크플로우 — 데일리 노트, 빠른 캡처, OS 자동화
- 옵시디언 사용자 멘탈 모델과 연속성 (전환 비용 감소)

## 2. 요구사항

### 2.1 기능 요구사항 (계층별)

#### 계층 1 — v1.0 후반 (P0)

| ID | 요구사항 |
|---|---|
| CLI-01 | `munix://open?vault=...&file=...&line=...` URI 처리 |
| CLI-02 | `munix path/to/note.md` args로 파일 열기 |
| CLI-03 | 이미 실행 중인 인스턴스로 forwarding (single-instance) |
| CLI-04 | macOS / Windows / Linux OS 통합 (URL handler 등록) |
| CLI-05 | URI 첫 호출 시 사용자 승인 prompt (보안) |

#### 계층 2 — v1.1 (P1)

| ID | 요구사항 |
|---|---|
| CLI-06 | `munix new <title>` — 새 노트 생성 + 열기 |
| CLI-07 | `munix daily` — 오늘 데일리 노트 |
| CLI-08 | `munix search <query>` — 검색 결과 패널 열기 |
| CLI-09 | `munix --vault <path>` — 특정 vault 강제 |
| CLI-10 | `munix --new-window` — single-instance 우회 |
| CLI-11 | shell 자동완성 스크립트 (zsh/bash/fish) |

#### 계층 3 — v1.2+ (P2)

| ID | 요구사항 |
|---|---|
| CLI-12 | Unix socket API (`/tmp/munix.sock`) — JSON-RPC |
| CLI-13 | `munix get/set` — 외부 도구 상태 질의 |
| CLI-14 | x-callback-url 패턴 (Apple 표준) |
| CLI-15 | macOS Quick Action / Windows Send To 통합 |

### 2.2 비기능 요구사항

- URI 핸들러 응답 < 200ms (창이 이미 떠있을 때)
- 새 인스턴스 콜드 스타트 < 2s (Tauri 평균)
- 보안: vault 외부 경로 차단 (path traversal, ADR-016 정합)
- 보안: 위험 액션은 명시적 사용자 승인

---

## 3. 데이터 모델

### 3.1 URI scheme

```
munix://<action>?<params>
```

| Action | 설명 | 필수 params | 옵션 params |
|---|---|---|---|
| `open` | 파일 열기 | `vault` | `file`, `line`, `column` |
| `new` | 새 노트 생성 + 열기 | `vault`, `file` | `content` (URL-encoded) |
| `daily` | 오늘 데일리 노트 | `vault` | (frontmatter 자동) |
| `search` | 검색 결과 열기 | `vault`, `q` | `mode` (text/regex) |

예:
- `munix://open?vault=/Users/me/notes&file=daily/2026-04-25.md`
- `munix://new?vault=/Users/me/notes&file=inbox/quick.md&content=%EB%A9%94%EB%AA%A8`
- `munix://search?vault=/Users/me/notes&q=react+hooks`

### 3.2 CLI args

```
munix [options] <command> [args]

Options:
  --vault <path>       특정 vault 강제
  --new-window         새 창 (single-instance 우회)
  --json               결과를 JSON으로 stdout (계층 3)

Commands:
  open <file>          파일 열기 (vault 추정 또는 --vault 명시)
  new <title> [-c <content>]
                       새 노트 생성 + 열기
  daily                오늘 데일리 노트
  search <query>       검색
  (계층 3)
  get <key>            상태 질의 (current-file, current-vault 등)
  set <key> <value>    상태 변경 (제한적)
```

### 3.3 라우팅 (Rust)

```rust
enum CliCommand {
  Open { vault: Option<PathBuf>, file: PathBuf, line: Option<u32> },
  New { vault: Option<PathBuf>, title: String, content: Option<String> },
  Daily { vault: Option<PathBuf> },
  Search { vault: Option<PathBuf>, query: String, mode: SearchMode },
}

fn parse_uri(uri: &str) -> Result<CliCommand, CliError>;
fn parse_args(args: &[String]) -> Result<CliCommand, CliError>;
fn dispatch(cmd: CliCommand, app: &AppHandle) -> Result<()>;
```

---

## 4. API/인터페이스

### 4.1 Tauri 플러그인

- **`tauri-plugin-deep-link`**: URI scheme 등록 + 이벤트 수신
  - macOS: Info.plist `CFBundleURLTypes`
  - Windows: registry `HKCU\Software\Classes\munix`
  - Linux: `.desktop` 파일 `MimeType=x-scheme-handler/munix`
- **`tauri-plugin-single-instance`**: 두 번째 실행 시 args를 첫 인스턴스로 forwarding

### 4.2 라우팅 흐름

```
[OS]
  munix://open?... 클릭
        ↓
[Tauri deep-link plugin]
  uri 이벤트 수신
        ↓
[parse_uri]
  CliCommand 변환
        ↓
[validate]
  vault 외부 경로? path traversal? capability?
        ↓
[dispatch]
  ├─ Open → editor.openFile(path)
  ├─ New → editor.createAndOpen(path, content)
  ├─ Daily → daily.openOrCreateToday()
  └─ Search → searchPanel.open(query)
```

### 4.3 보안 검증

```rust
fn validate_path(vault: &Path, file: &Path) -> Result<PathBuf, CliError> {
  let canonical = vault.join(file).canonicalize()?;
  if !canonical.starts_with(vault) {
    return Err(CliError::PathTraversal);  // ADR-016 정합
  }
  Ok(canonical)
}

fn require_user_confirmation(cmd: &CliCommand) -> bool {
  matches!(cmd, CliCommand::New { .. })  // 첫 호출 시
}
```

---

## 5. UI/UX 플로우

### 5.1 URI 클릭 (브라우저)

1. 사용자가 브라우저/이메일에서 `munix://...` 클릭
2. OS가 Munix 실행 (없으면 spawn, 있으면 deep-link 이벤트로 forward)
3. **첫 호출 시**: "이 URL을 열까요?" 확인 모달 + "이후 자동 허용" 옵션
4. Munix 창 포커스 + 액션 수행

### 5.2 셸 호출

```bash
$ munix open ~/notes/today.md
# → 이미 실행 중이면 즉시 열림, 아니면 spawn 후 열림

$ munix new "회의록 2026-04-25"
# → vault/inbox/회의록 2026-04-25.md 생성 후 열기

$ munix daily
# → vault/daily/2026-04-25.md (없으면 생성)

$ munix search "react hooks"
# → 검색 패널 열림
```

### 5.3 단일 인스턴스 충돌

- 다른 vault 열린 상태에서 다른 vault의 파일 호출 → "Vault A에서 Vault B로 전환?" prompt
- `--new-window`로 우회 가능 (계층 2)

### 5.4 OS 등록 첫 경험

- 첫 실행 시 "munix:// URL을 처리하도록 등록할까요?" prompt
- 거부해도 앱 자체는 정상 동작 (CLI만 사용 가능)

---

## 6. 에러 처리

| 케이스 | 처리 |
|---|---|
| vault 외부 경로 (path traversal) | 거부 + 알림 |
| 존재하지 않는 파일 | "파일이 없습니다. 생성하시겠습니까?" 또는 거부 |
| URI 형식 오류 | 무시 + 로그 (사용자 알림 X — 노이즈) |
| `--vault` 지정 vault 없음 | 알림 + 가장 최근 vault로 폴백 |
| URI 첫 호출 사용자 거부 | 액션 취소 |
| OS가 deep-link 등록 차단 (보안 정책) | 알림 + CLI만 사용 안내 |

---

## 7. 엣지 케이스

- **vault 미오픈 상태에서 `munix open` 호출**: 가장 최근 vault 사용
- **다중 vault 동시 (v2.0)**: vault 매칭 우선순위 — `--vault` > URI `vault` param > 현재 활성 vault > 최근 vault
- **macOS Gatekeeper**: 첫 deep-link 호출 차단 가능 (서명 안 된 빌드)
- **Windows SmartScreen**: registry 등록 차단 가능
- **Linux 환경별 차이**: `xdg-mime` 지원 안 되는 경량 WM
- **WSL 사용자**: Windows에서 WSL 경로 (`\\wsl$\Ubuntu\...`) 처리
- **OS path 구분자 차이**: 항상 `/`로 통일 (CLAUDE.md 컨벤션 정합)
- **content URL-encoding**: 멀티바이트 (한글) 정상 디코딩 검증
- **동시 다중 URI**: 100개 URI를 동시에 호출하면 큐잉 또는 throttle

---

## 8. 테스트 케이스

- `munix://open?vault=...&file=...` → 해당 파일 열림
- `munix://open?...&line=42` → 42번 라인으로 스크롤
- `munix://new?...&content=...` (URL-encoded 한글) → 정확한 본문
- `munix://search?...&q=test` → 검색 패널 + 결과 표시
- 셸 args 파싱 모든 조합 (`munix open foo`, `munix --vault X open foo`)
- single-instance forwarding — 다른 PID에서 호출
- path traversal 시도 (`file=../etc/passwd`) → 거부
- 같은 URI 100회 호출 → 정상 처리 또는 throttle
- 사용자 거부 시 액션 취소
- OS별 등록 (macOS Info.plist, Windows registry, Linux .desktop)

---

## 9. 오픈 이슈

- [ ] 다중 vault 시 vault 매칭 알고리즘 (priority chain)
- [ ] URI 핸들러 첫 등록 동의 prompt UI — OS-level vs 앱 내?
- [ ] x-callback-url 표준 따를지 (`x-success`, `x-error` 콜백)
- [ ] CLI 자동완성 (zsh/bash/fish 완성 스크립트 — 계층 2)
- [ ] 시스템 trayicon에서 quick action (계층 2~3)
- [ ] `munix daily` 의 "오늘" 정의 — 자정 기준 / 4am 기준 (사용자 설정)?
- [ ] daily 노트 템플릿 ([settings-spec.md](./settings-spec.md) 통합)
- [ ] 데일리 노트 경로 컨벤션 — `daily/YYYY-MM-DD.md` vs `journal/YYYY/MM/DD.md`?
- [ ] CLI 결과 stderr/stdout 분리 (스크립트 친화적)
- [ ] Unix socket API 인증 (계층 3) — 같은 사용자만 vs token

---

## 10. 의존 관계

- **선행 ADR**: [ADR-024](../decisions.md#adr-024-cli--uri-scheme-munix)
- **연관 ADR**: [ADR-016](../decisions.md) (vault sandbox와 path traversal 방어선 정합)
- **연관 spec**: [vault-spec.md](./vault-spec.md) (path validation), [search-spec.md](./search-spec.md) (search 액션 통합)
- **외부 의존**:
  - [tauri-plugin-deep-link](https://v2.tauri.app/plugin/deep-linking/) (MIT)
  - [tauri-plugin-single-instance](https://v2.tauri.app/plugin/single-instance/) (MIT)

---

**문서 버전:** v0.1 (초안)
**작성일:** 2026-04-25
**상태:** Proposed — 계층 1 v1.0 후반 구현 시 v0.2로 업데이트
