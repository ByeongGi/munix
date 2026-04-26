# Plugin System 상세 설계 — Munix

> 상태: **초안 (proposed)**. [ADR-022](../decisions.md#adr-022-플러그인-시스템-extism-wasm) 채택 후 확정.
> v1.1 핵심 인프라. 옵시디언 호환 ✗ (보안 모델 다름).

---

## 1. 목적

- v1.1+ 무거운 기능을 코어 비대화 없이 추가 (터미널, 그래프 뷰, 외부 도구 통합 등)
- **보안 타겟 (CLAUDE.md "클라우드 동기화 불가 환경") 호환** — capability 기반 권한 모델
- Obsidian 플러그인 생태계의 가치 + Munix 보안 가치 양립
- 옵시디언이 살아남은 결정적 이유 — 동일 패턴을 안전하게 재현

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 요구사항 | 우선순위 |
|---|---|---|
| PLG-01 | `.munix/plugins/{name}/` 디렉터리에서 manifest + WASM 자동 발견/로드 | P0 |
| PLG-02 | manifest의 capability를 사용자가 명시 승인 (첫 활성화 시) | P0 |
| PLG-03 | Extism host function으로 플러그인 ↔ 코어 통신 | P0 |
| PLG-04 | 플러그인 활성화/비활성화 토글 (재시작 없이) | P0 |
| PLG-05 | 플러그인 panic/에러 격리 — 한 플러그인 크래시가 코어/타 플러그인에 영향 X | P0 |
| PLG-06 | 플러그인이 사이드 패널 / 명령 / 슬래시 / 설정 페이지 등록 | P1 |
| PLG-07 | WASM 모듈 SHA-256 hash 검증 (manifest에 명시) | P1 |
| PLG-08 | 플러그인 자동 업데이트 (manifest의 update_url) | P2 |
| PLG-09 | 마켓플레이스 (커뮤니티 플러그인 등록부) | P2 |

### 2.2 비기능 요구사항

- 플러그인 콜드 스타트 < 100ms (WASM 모듈 instantiate)
- 플러그인당 메모리 한도 (기본 64MB, manifest로 override 가능)
- 플러그인당 CPU 한도 (Extism timeout, 기본 30s/host call)
- WASM 모듈 검증 < 50ms

---

## 3. 데이터 모델

### 3.1 Manifest (`manifest.json`)

```json
{
  "name": "terminal",
  "version": "0.1.0",
  "displayName": "Terminal",
  "description": "Embedded terminal in side panel",
  "author": "munix",
  "license": "MIT",
  "homepage": "https://github.com/munix/plugin-terminal",
  "munixApiVersion": "1.0",
  "capabilities": {
    "required": ["pty", "fs:vault"],
    "optional": ["net"]
  },
  "ui": {
    "panel": {
      "position": "bottom",
      "title": "Terminal",
      "icon": "terminal"
    },
    "settingsPage": true
  },
  "commands": [
    { "id": "terminal.open", "title": "Terminal: Open" },
    { "id": "terminal.split", "title": "Terminal: Split" }
  ],
  "wasm": "plugin.wasm",
  "wasmHash": "sha256:abc123..."
}
```

### 3.2 Capability 모델

```ts
type Capability =
  | 'pty'           // 셸/PTY spawn (위험 — 별도 강조 표시)
  | 'fs:vault'      // vault 안 fs r/w (vault 외부는 항상 거부)
  | 'fs:asset'      // assets/ 만 r/w
  | 'net'           // 외부 네트워크 (HTTP only, raw socket X)
  | 'clipboard'     // clipboard r/w
  | 'shell:exec'    // 임의 명령 실행 (위험 — 별도 강조)
  | 'notification'  // OS 알림
  | 'ui:panel'      // 사이드/하단 패널 등록
  | 'ui:command'    // command palette 명령 등록
  | 'ui:slash';     // 슬래시 메뉴 항목 등록
```

위험도 분류:
- 🔴 위험: `pty`, `shell:exec`, `net` — UI에서 빨간색 + "이 권한은 ... 할 수 있습니다" 명시
- 🟡 주의: `fs:vault`, `clipboard`
- 🟢 일반: `fs:asset`, `notification`, `ui:*`

### 3.3 활성화 상태

```ts
// vault별로 저장 (.munix/plugins-state.json)
interface PluginState {
  name: string;
  enabled: boolean;
  approvedCapabilities: Capability[];
  lastApprovedVersion: string;  // 새 버전이 새 capability 요청 시 재승인
}
```

---

## 4. API/인터페이스

### 4.1 Host Function (Rust 측 — 플러그인이 호출)

```rust
// 모든 host function은 capability 검사를 거침
host_fn!(vault_read_file(path: String) -> String);
host_fn!(vault_write_file(path: String, content: String));
host_fn!(vault_list(path: String) -> Vec<DirEntry>);

host_fn!(notify(title: String, body: String));
host_fn!(register_command(id: String, title: String));
host_fn!(open_panel(panel_id: String));

host_fn!(pty_spawn(shell: String, cwd: String) -> SessionId);
host_fn!(pty_write(id: SessionId, data: Vec<u8>));
host_fn!(pty_resize(id: SessionId, cols: u16, rows: u16));

host_fn!(http_fetch(url: String, opts: FetchOpts) -> Response);
host_fn!(clipboard_read() -> String);
host_fn!(clipboard_write(text: String));
```

### 4.2 Plugin Hook (WASM export — 코어가 호출)

```rust
#[plugin_fn]
pub fn on_activate() -> FnResult<()>;

#[plugin_fn]
pub fn on_deactivate() -> FnResult<()>;

#[plugin_fn]
pub fn on_command(id: String) -> FnResult<()>;

#[plugin_fn]
pub fn on_file_open(path: String) -> FnResult<()>;

#[plugin_fn]
pub fn on_file_save(path: String) -> FnResult<()>;
```

### 4.3 UI 통합

플러그인 UI는 **격리된 Sandbox iframe**:

- src: `munix://plugin/{name}/ui/index.html`
- postMessage로 호스트와 양방향 통신
- CSS 토큰만 노출 (`--color-bg-primary`, `--font-sans` 등) — 호스트 DOM 직접 접근 불가
- iframe sandbox: `sandbox="allow-scripts allow-same-origin"` (allow-top-navigation 없음)

---

## 5. UI/UX 플로우

### 5.1 첫 설치

1. 사용자가 `.munix/plugins/foo/` 추가 (수동 또는 마켓플레이스 다운로드)
2. 코어가 manifest 발견 → 모달 표시:
   ```
   🆕 새 플러그인 발견: Foo (v0.1.0)
   설명: ...
   필요한 권한:
   🔴 pty — 셸/PTY를 spawn할 수 있습니다 (터미널 실행)
   🟡 fs:vault — vault 내 파일을 읽고 쓸 수 있습니다
   🟢 ui:panel — 사이드 패널을 등록합니다

   [활성화] [건너뛰기] [상세보기]
   ```
3. 사용자 승인 → 활성화 + 권한 저장 (`.munix/plugins-state.json`)

### 5.2 활성화/비활성화

- 설정 → 플러그인 페이지에서 토글
- 활성화: WASM 모듈 hash 검증 → instantiate → `on_activate()` 호출
- 비활성화: `on_deactivate()` → 모듈 unload → 등록한 UI 요소 제거

### 5.3 권한 추가 요청 (버전 업데이트)

- 새 버전이 새 capability 요청 시 자동 활성화 X
- "Foo v0.2.0이 새 권한을 요청합니다: net (외부 네트워크)" 모달 → 사용자 승인 필요

---

## 6. 에러 처리

| 케이스 | 처리 |
|---|---|
| WASM 로드 실패 (파일 없음/손상) | 알림 + 비활성화로 폴백 |
| WASM hash 불일치 | 거부 + "변조된 모듈" 알림 |
| host function 호출 시 capability 미확보 | 플러그인에 에러 반환 (`Err::PermissionDenied`) |
| 플러그인 panic | 격리, 코어 영향 X, 자동 비활성화 + 알림 |
| WASM timeout | host call 중단 + 플러그인에 에러 반환, 반복되면 자동 비활성화 |
| 메모리 한도 초과 | host call 거부 + 플러그인에 에러 |

---

## 7. 엣지 케이스

- **같은 이름 플러그인 중복**: 버전 비교 후 최신 우선, 충돌 시 사용자에게 선택
- **플러그인 간 호출**: 명시적 금지 — 코어 host function을 통해서만 통신 가능
- **vault 이동 시 플러그인 상태**: vault별 enabled 목록 보존 (`.munix/plugins-state.json`)
- **manifest의 `munixApiVersion` 불일치**: 메이저 버전 다르면 거부 + "이 플러그인은 Munix v2 용입니다" 알림
- **iframe UI에서 키보드 단축키 충돌**: 핵심 단축키(Cmd+S 등)는 호스트가 우선, 플러그인이 등록한 단축키는 패널 포커스 시에만
- **플러그인이 핵심 키맵 override 시도**: 거부 (capability에 `ui:keymap-override` 별도 필요, P2)

---

## 8. 테스트 케이스

- 가짜 capability 우회 시도 (host function 직접 호출) → 거부 확인
- 플러그인 panic 시 코어 정상 작동 + 다른 플러그인 영향 X
- 100개 플러그인 동시 활성화 시 메모리 한도 검증
- WASM hash 검증 (변조된 모듈 거부)
- 메모리 누수 — 플러그인 활성화/비활성화 100회 반복 후 메모리 안정
- iframe sandbox 탈출 시도 (top window 접근, parent.location 등) → 차단 확인
- vault 외부 경로 접근 시도 (`fs:vault` 권한으로 `../../etc/passwd`) → 거부

---

## 9. 오픈 이슈

- [ ] 플러그인 설정 UI 등록 방식 — 스키마 기반 자동 생성 (JSON Schema) vs 직접 React 컴포넌트?
- [ ] iframe UI에서 키보드 단축키 통합 방법 — 글로벌 vs 패널 포커스 한정?
- [ ] 플러그인이 핵심 키맵을 override할 수 있게 할지 (별도 capability 필요할 듯)
- [ ] 마켓플레이스 호스팅 — GitHub release vs 자체 서버 vs P2P?
- [ ] 플러그인 서명 (개발자 키) — manifest에 서명 + 신뢰 키 목록?
- [ ] Extism vs 직접 wasmtime 통합 — Extism의 추가 abstraction이 가치 있는지 비교 필요
- [ ] 플러그인 디버깅 도구 — host call 로그, panic stack trace 표시
- [ ] 플러그인이 다른 플러그인의 존재를 알 수 있게 할지 (내부 의존성 그래프)
- [ ] 플러그인 마이그레이션 (manifest 스키마 변경 시)

---

## 10. 의존 관계

- **선행 ADR**: [ADR-022](../decisions.md#adr-022-플러그인-시스템-extism-wasm) (시스템 아키텍처)
- **종속 ADR**: [ADR-023](../decisions.md#adr-023-터미널-플러그인-1호) (터미널은 이 시스템 위 reference 구현)
- **연관 spec**: [vault-spec.md](./vault-spec.md) (fs:vault capability가 vault 모듈 통과), [keymap-spec.md](./keymap-spec.md) (`ui:command` capability 통합), [settings-spec.md](./settings-spec.md) (플러그인 토글 UI)

---

**문서 버전:** v0.1 (초안)
**작성일:** 2026-04-25
**상태:** Proposed — 다음 세션 정식 채택 후 v0.2로 업데이트
