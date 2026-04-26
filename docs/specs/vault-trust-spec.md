# Vault Trust 상세 설계 — Munix

> VS Code Workspace Trust와 유사한 vault 단위 신뢰 모델. 사용자가 신뢰한 vault에 대해서만 시스템 파일 관리자 열기, Git, Terminal, 플러그인 등 고위험 로컬 연동을 허용한다.

---

## 1. 목적

Munix는 로컬 파일 시스템을 직접 다룬다. vault 위치는 사용자가 선택하므로 `$HOME/**` 같은 정적 Tauri scope만으로는 안전성과 유연성을 동시에 만족하기 어렵다.

Vault Trust의 목적:

- 프론트엔드가 임의 절대경로를 열지 못하게 함
- 모든 고위험 동작을 Rust vault 경계 안에서 검증
- 사용자가 vault 단위로 명시적으로 신뢰 여부를 결정
- 외장 디스크, 공유 폴더, 홈 밖 경로도 vault로 열 수 있게 함

---

## 2. 요구사항

| ID | 요구사항 | 우선순위 |
|---|---|---|
| VTR-01 | 현재 vault root 기준 신뢰 여부 저장 | P0 |
| VTR-02 | 신뢰되지 않은 vault에서 시스템 연동 시 권한 요청 UI 표시 | P0 |
| VTR-03 | 프론트는 절대경로 opener를 직접 호출하지 않음 | P0 |
| VTR-04 | Rust IPC는 vault 상대경로만 입력받음 | P0 |
| VTR-05 | Rust에서 path traversal 및 vault 외부 경로 차단 | P0 |
| VTR-06 | 신뢰된 vault에서 Finder/Explorer reveal 허용 | P0 |
| VTR-07 | Git/Terminal/Plugin capability는 trust 위에서만 허용 | P1 |
| VTR-08 | 신뢰 철회 UI | P2 |

---

## 3. 신뢰 저장 모델

저장 위치:

- `app_config_dir()/trusted-vaults.json`

형식:

```json
{
  "version": 1,
  "roots": [
    "/Users/me/Documents/notes",
    "/Volumes/work/company-vault"
  ]
}
```

정책:

- root는 canonical absolute path로 저장
- symlink 경유 경로는 canonical root 기준으로 비교
- vault를 이동하면 신뢰는 자동 승계하지 않음
- 파일 단위 신뢰는 두지 않음

---

## 4. IPC API

```ts
is_current_vault_trusted(): Promise<boolean>
trust_current_vault(): Promise<void>
reveal_in_system(relPath: string): Promise<void>
```

### 4.1 reveal_in_system

입력은 vault 기준 상대경로만 받는다.

Rust 처리 순서:

1. 현재 vault가 열려 있는지 확인
2. 현재 vault root가 trusted인지 확인
3. `relPath`를 vault root 기준으로 resolve
4. canonical path가 vault root 내부인지 검증
5. OS 파일 관리자에서 reveal

신뢰되지 않은 vault면:

```json
{ "type": "PermissionRequired", "message": "/absolute/vault/root" }
```

을 반환한다.

---

## 5. UX 플로우

사용자가 `시스템 파인더에서 보기` 실행:

```text
if trusted:
  Finder/Explorer에서 항목 표시
else:
  "이 vault를 신뢰하고 시스템 파일 관리자에서 항목을 열까요?"
  [신뢰하고 열기] [취소]
```

사용자가 신뢰하면:

1. `trust_current_vault()`
2. 원래 액션 재시도

초기 구현은 `window.confirm` 기반이어도 된다. 정식 UI에서는 앱 내부 다이얼로그로 교체한다.

---

## 6. Tauri Capability 정책

프론트엔드에는 넓은 opener path scope를 주지 않는다.

금지:

```json
{ "identifier": "opener:allow-open-path", "allow": [{ "path": "$HOME/**" }] }
```

권장:

- 프론트는 `opener.openPath` / `revealItemInDir` 직접 호출 금지
- Rust IPC 커맨드가 `tauri_plugin_opener::OpenerExt`를 사용
- Rust에서 vault trust + path validation을 수행

---

## 7. 적용 대상

P0:

- 시스템 파일 관리자에서 보기

P1:

- Git 연동
- Terminal cwd 실행
- 플러그인 capability 승인
- 외부 앱으로 열기

P2:

- 신뢰 철회 UI
- 읽기 전용 vault 모드
- workspace trust banner

---

## 8. 에러 처리

| 상황 | 처리 |
|---|---|
| vault 미오픈 | `NotOpen` |
| relPath traversal | `PathTraversal` |
| vault 미신뢰 | `PermissionRequired` |
| OS opener 실패 | `Io` |
| 대상 삭제됨 | `NotFound` |

---

## 9. 테스트 케이스

- 신뢰되지 않은 vault에서 reveal 실행 → `PermissionRequired`
- 신뢰 후 같은 reveal 재시도 → 성공
- `../outside` reveal 시도 → `PathTraversal`
- symlink로 vault 밖 파일 접근 시도 → 차단
- 홈 밖 vault를 신뢰 후 reveal → 성공
- 앱 재시작 후 trusted vault 목록 유지

---

## 10. 상태

- 상태: ✅ partial accepted — 이미 적용된 부분은 stable, P1/P2 항목은 후속
- 작성일: 2026-04-26
- 최근 업데이트: 2026-04-26 — ADR-031 C-6 통합. 새 vault open 시 plugin-dialog `confirm` 으로 trust prompt + `.munix/` 자동 생성 동의. registry 에서 vault 제거 시 trusted-vaults 도 같이 untrust (보안 일관성)
- 적용된 항목: VTR-01 ~ VTR-06 + 새 vault open prompt
- 후속: VTR-07 (Git/Terminal/Plugin), VTR-08 (신뢰 철회 UI)
