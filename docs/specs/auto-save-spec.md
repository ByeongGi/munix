# 자동 저장 상세 설계 — Munix

> 에디터 입력을 디스크에 안전하게 반영하는 파이프라인. 외부 편집 충돌도 처리.

---

## 1. 목적

- 사용자가 "저장" 버튼을 누르지 않아도 변경이 유실되지 않도록 보장
- 외부 편집(Obsidian, Git 등)과 충돌을 감지하고 해결 경로 제공
- 저장 상태를 UI에 명확히 표시하여 신뢰 확보

---

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 요구사항 | 우선순위 |
|---|---|---|
| SAV-01 | 타이핑 멈춘 후 750ms 뒤 자동 저장 | P0 |
| SAV-02 | 블러/포커스 아웃 시 즉시 저장 | P0 |
| SAV-03 | 파일 전환 시 이전 파일 즉시 저장 | P0 |
| SAV-04 | 앱 종료 전 저장 완료 대기 | P0 |
| SAV-05 | 저장 상태 UI 표시 (저장중/저장됨/오류) | P0 |
| SAV-06 | 외부 편집 충돌 감지 (mtime 비교) | P1 |
| SAV-07 | 저장 실패 시 재시도 로직 | P1 |
| SAV-08 | 다운타임 변경 내역 로컬 백업 | P2 |
| SAV-09 | 수동 저장 단축키 (Cmd+S) — 즉시 flush | P0 |

### 2.2 비기능 요구사항

- 저장 중에도 입력 계속 가능 (non-blocking)
- 저장 지연: 평균 50ms, 최악 500ms 이하
- 버퍼링된 변경 없이 종료 허용 안 함

---

## 3. 상태 머신

```
         idle
          │ user types
          ▼
        dirty
     ┌────┴─────┐
     │ 750ms    │ blur/switch/Cmd+S
     │ debounce │
     ▼          ▼
    saving ◀───┘
     │
     ├─ success ──→ saved ──→ idle
     │
     └─ error ────→ error
                    │ retry
                    ▼
                  saving
```

### 3.1 상태 정의

```ts
type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'dirty'; since: number }
  | { kind: 'saving'; attempt: number }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; error: string; retryAt: number };
```

### 3.2 전환 규칙

| 현재 상태 | 이벤트 | 다음 상태 |
|----------|--------|----------|
| idle | 입력 | dirty |
| dirty | 750ms 경과 | saving |
| dirty | blur / switch / Cmd+S | saving |
| saving | 성공 | saved |
| saving | 실패 | error |
| saved | 1.5s 경과 | idle |
| saved | 입력 | dirty |
| error | 재시도 (5s 지수) | saving |
| error | 수동 재시도 | saving |

---

## 4. 아키텍처

### 4.1 레이어

```
┌──────────────────────────────────┐
│ Editor (Tiptap)                  │
│   │ onUpdate                     │
│   ▼                              │
│ useAutoSave (훅)                 │
│   │ debounce 750ms               │
│   ▼                              │
│ SaveQueue (Zustand store)        │
│   │ next job                     │
│   ▼                              │
│ invoke('write_file')             │
│   │                              │
│   ▼                              │
│ Rust: 원자적 쓰기                │
└──────────────────────────────────┘
```

### 4.2 SaveQueue 설계

한 파일에 대해 여러 변경이 쌓이지 않도록 **파일당 pending 작업 1개**만 유지.

```ts
interface SaveJob {
  path: string;
  content: string;
  baseModified: number;  // 로드 시점의 mtime
  enqueuedAt: number;
}

interface SaveQueueState {
  jobs: Map<string, SaveJob>;           // path → job (최신만)
  inFlight: Set<string>;                // 진행 중
  errors: Map<string, SaveError>;
  flush: (path?: string) => Promise<void>;  // path 생략 시 전체
  enqueue: (job: SaveJob) => void;
}
```

**규칙:**
- 같은 path의 새 작업이 들어오면 기존 것을 덮어씀
- `inFlight`에 있는 파일이면 새 작업은 큐에 대기, 완료 후 다음 실행
- 에러 상태에서는 새 변경이 들어와도 즉시 재시도 (5초 대기 취소)

---

## 5. useAutoSave 훅

```ts
// src/hooks/useAutoSave.ts

import { useEffect, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useSaveQueue } from '@/store/saveQueue';

export function useAutoSave(
  editor: TiptapEditor | null,
  filePath: string | null,
  baseModified: number,
) {
  const enqueue = useSaveQueue((s) => s.enqueue);
  const latestRef = useRef<{ content: string; modified: number }>({
    content: '',
    modified: baseModified,
  });

  const debouncedSave = useDebouncedCallback(() => {
    if (!editor || !filePath) return;
    const md = editor.storage.markdown.getMarkdown();
    enqueue({
      path: filePath,
      content: md,
      baseModified: latestRef.current.modified,
      enqueuedAt: Date.now(),
    });
  }, 750);

  useEffect(() => {
    if (!editor || !filePath) return;

    const onUpdate = () => {
      debouncedSave();
    };

    const onBlur = () => {
      debouncedSave.flush();
    };

    editor.on('update', onUpdate);
    editor.on('blur', onBlur);

    return () => {
      editor.off('update', onUpdate);
      editor.off('blur', onBlur);
      debouncedSave.flush();
    };
  }, [editor, filePath, debouncedSave]);
}
```

---

## 6. 충돌 감지 및 처리

### 6.1 감지 규칙

저장 요청 시 `expected_modified`(로드 시점의 mtime)를 전달. Rust가 현재 파일의 mtime과 비교.

```ts
// 클라이언트 → 서버
interface WriteRequest {
  rel_path: string;
  content: string;
  expected_modified: number;
}

// 서버 → 클라이언트
interface WriteResponse {
  modified: number;
  conflict: boolean;  // expected_modified ≠ 실제 시 true
}
```

### 6.2 충돌 발생 시 UX

**옵션 A: 자동 병합 시도** — v1에서는 제외 (복잡)
**옵션 B: 사용자 선택 다이얼로그** — v1 채택

```
┌─────────────────────────────────────┐
│  ⚠ 외부에서 파일이 변경되었습니다     │
│                                     │
│  이 파일을 다른 앱(예: Obsidian)에서 │
│  수정한 것으로 보입니다.             │
│                                     │
│  어떻게 할까요?                      │
│                                     │
│  [ 내 변경으로 덮어쓰기 ]            │
│  [ 외부 변경 불러오기 (내 변경 버림) ]│
│  [ 비교하기 (diff 뷰) ]              │
│  [ 취소 ]                            │
└─────────────────────────────────────┘
```

### 6.3 Diff 뷰 (옵션)

- 좌: 내 버전 (에디터 현재 내용)
- 우: 디스크 버전
- 둘 사이에서 선택적으로 병합

v1에서는 단순 텍스트 diff 표시 (react-diff-viewer). 실제 병합은 사용자가 수동으로 재입력.

---

## 7. 저장 상태 UI

### 7.1 인디케이터 위치

- 에디터 헤더 우상단 (파일명 옆)
- 텍스트 + 아이콘

### 7.2 표시 규칙

| 상태 | 텍스트 | 색상 | 아이콘 |
|------|--------|------|--------|
| idle | (숨김) | - | - |
| dirty | "저장 대기중..." | gray-500 | 점 |
| saving | "저장 중..." | blue-500 | 스피너 |
| saved | "저장됨" | green-500 | 체크 |
| error | "저장 실패 — 재시도" | red-500 | 경고 |
| conflict | "충돌 — 확인 필요" | orange-500 | 경고 |

- saved 상태는 1.5s 후 idle로 전환
- error 상태는 클릭 시 상세 정보 토스트

### 7.3 접근성

- `aria-live="polite"`로 스크린 리더에 알림
- 색상뿐 아니라 아이콘/텍스트로도 구분

---

## 8. 재시도 로직

### 8.1 지수 백오프

```ts
function getRetryDelay(attempt: number): number {
  // 1초, 2초, 4초, 8초, 최대 30초
  return Math.min(1000 * Math.pow(2, attempt - 1), 30000);
}
```

### 8.2 재시도 조건

| 에러 | 재시도 |
|------|-------|
| 네트워크 없음 (로컬이니 거의 없음) | 예 |
| 디스크 풀 | 아니오 (즉시 사용자 알림) |
| 권한 거부 | 아니오 (알림) |
| 일시적 IO 오류 | 예 (최대 5회) |
| 파일 잠김 | 예 |

### 8.3 최대 실패 처리

5회 연속 실패 시:
- 에디터 상단에 배너 표시 "저장이 계속 실패합니다. 파일을 확인하세요."
- 내용을 `.munix/backup/{timestamp}-{filename}`에 덤프 백업

---

## 9. 종료 시 처리

### 9.1 앱 종료 (Cmd+Q)

Tauri의 `close_requested` 이벤트 가로채기:

```rust
#[tauri::command]
async fn request_close(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), VaultError> {
    // 프론트엔드에 pending 저장 flush 요청
    app.emit_all("app:before-close", ())?;
    // 프론트엔드가 응답하면 실제 종료
    Ok(())
}
```

프론트엔드:

```ts
listen('app:before-close', async () => {
  await useSaveQueue.getState().flushAll();
  await invoke('confirm_close');
});
```

### 9.2 창 닫기 (파일 전환 포함)

- 파일 전환 전 현재 파일 `flush()` 호출 (blocking)
- 실패 시 사용자에게 확인: "저장되지 않은 변경이 있습니다. 계속하시겠습니까?"

### 9.3 강제 종료 대비

- 매 저장 시 `.munix/backup/last.md`에도 동시 기록 (선택)
- 앱 재시작 시 마지막 백업과 현재 파일 비교 → 불일치 시 복구 제안

---

## 10. 이벤트/로깅

### 10.1 프론트엔드 이벤트

```ts
// Zustand store가 발행
type SaveEvent =
  | { type: 'save:start'; path: string }
  | { type: 'save:success'; path: string; duration: number }
  | { type: 'save:error'; path: string; error: string }
  | { type: 'save:conflict'; path: string };
```

### 10.2 개발자 콘솔

개발 모드에서만:
```
[AutoSave] enqueue: note.md (1240 bytes)
[AutoSave] saving: note.md
[AutoSave] saved: note.md (42ms)
```

---

## 11. 테스트 케이스

### 11.1 단위 테스트

- [ ] 연속 입력 중 750ms 동안 단 1번만 저장 호출
- [ ] 파일 전환 시 이전 파일 즉시 저장
- [ ] 에러 후 지수 백오프 시간 검증
- [ ] 큐에 동일 path 중복 enqueue 시 마지막 것만 유지

### 11.2 통합 테스트

- [ ] 저장 도중 앱 kill → 재시작 시 데이터 유지
- [ ] 외부에서 파일 수정 → 내 변경 저장 시 충돌 다이얼로그
- [ ] 디스크 풀 시뮬레이션 → 사용자 알림 + 재시도 없음

### 11.3 E2E 시나리오

1. 파일 편집 → 1초 대기 → UI "저장됨" 표시 → 파일 mtime 변경 확인
2. Obsidian에서 파일 수정 → Munix에서 편집 후 저장 시도 → 충돌 다이얼로그
3. 앱 종료 명령 → pending 저장 flush → 정상 종료

---

## 12. 엣지 케이스

- **연속된 blur/focus**: debounce와 blur 핸들러가 겹치지 않도록 flush 내부에 lock
- **읽기 전용 파일**: 저장 시도 실패 → 사용자 알림 + 읽기 전용 모드 전환
- **매우 큰 파일 저장 시간**: 저장 중 새 입력 → 큐에 최신 반영
- **네트워크 드라이브/동기화 폴더**: mtime 정확도 낮음 → 충돌 오탐 가능 → 임계값 설정 (±2초)
- **클럭 스큐**: 사용자 PC 시간이 돌아간 경우 → abs(delta) 사용

---

## 13. 오픈 이슈

1. **로컬 백업 전략**: 매 저장마다 백업할지, 타임머신처럼 주기적으로 할지
2. **iCloud/Dropbox 폴더 특수 처리**: 동기화 중 잠금 파일 대응
3. **UI의 "저장됨" 피드백**: 1.5s 후 사라짐이 너무 빠른가? 사용자 테스트 필요
4. **충돌 뷰에 word-level diff 제공 여부**: v1.1+
5. **저장 단위의 원자성**: 한 번에 여러 파일이 변경되는 경우(예: 이름 변경) 트랜잭션화?

---

**문서 버전:** v0.1
**작성일:** 2026-04-25
**관련 문서:**
- [editor-spec.md](./editor-spec.md)
- [vault-spec.md](./vault-spec.md)
