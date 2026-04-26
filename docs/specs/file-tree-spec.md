# File Tree 상세 설계 — Munix

> 좌측 사이드바에 vault의 폴더/파일을 트리로 표시하는 컴포넌트. 파일 조작의 진입점.

---

## 1. 목적

- vault의 디렉토리 구조를 시각적으로 탐색
- 파일·폴더 생성/이름변경/삭제/이동을 직관적으로 수행
- 외부 파일 시스템 변경을 실시간 반영

---

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 요구사항 | 우선순위 |
| --- | --- | --- |
| FT-01 | 트리 렌더링 (폴더 접기/펴기) | P0 |
| FT-02 | 파일 클릭 시 에디터에 로드 | P0 |
| FT-03 | 현재 선택된 파일 하이라이트 | P0 |
| FT-04 | 새 파일/폴더 생성 (컨텍스트 메뉴, 단축키) | P0 |
| FT-05 | 이름 변경 (인라인 입력) | P0 |
| FT-06 | 삭제 (휴지통 이동) | P0 |
| FT-07 | 드래그 앤 드롭 이동 | P1 |
| FT-08 | 파일 시스템 이벤트 반영 | P0 |
| FT-09 | 폴더 접힘 상태 localStorage 저장 | P1 |
| FT-10 | 파일명 필터 (즉시 검색) | P1 |
| FT-11 | 정렬 옵션 (이름/수정일/크기) | P2 |
| FT-12 | 다중 선택 (Shift+Click, Cmd/Ctrl+Click) | P1 |
| FT-13 | 다중 선택 항목 일괄 삭제/이동/경로 복사 | P1 |

### 2.2 비기능 요구사항

- 1,000개 파일 트리 렌더링 &lt; 200ms
- 5,000개+ 시 가상 스크롤 (`react-virtuoso`)
- 폴더 펼침/접힘 애니메이션 &lt; 150ms

---

## 3. 데이터 모델

### 3.1 Tree Node

```ts
// src/types/filesystem.ts
interface FileNode {
  path: string;        // vault 기준 상대 경로 (예: "projects/foo.md")
  name: string;        // 표시용 파일/폴더 이름
  kind: 'file' | 'directory';
  size?: number;       // 파일만
  modified?: number;   // unix timestamp
  children?: FileNode[]; // 폴더만, undefined면 미로드
  depth?: number;      // 렌더 시 계산
}
```

### 3.2 Zustand Store

```typescript
// src/store/fileTree.ts
interface FileTreeState {
  nodes: FileNode[];                    // 루트 노드 배열
  expandedPaths: Set<string>;           // 펼쳐진 폴더 경로
  selectedPath: string | null;          // 현재 선택 파일
  selectedPaths: Set<string>;           // 다중 선택된 파일/폴더
  anchorPath: string | null;             // Shift range 선택 기준점
  renamingPath: string | null;          // 인라인 편집 중
  filter: string;                       // 이름 필터

  // 액션
  loadTree: () => Promise<void>;
  toggleExpand: (path: string) => void;
  select: (path: string, mode?: 'replace' | 'toggle' | 'range') => void;
  clearSelection: () => void;
  startRename: (path: string) => void;
  commitRename: (path: string, newName: string) => Promise<void>;
  cancelRename: () => void;
  createFile: (parentPath: string | null, name?: string) => Promise<string>;
  createFolder: (parentPath: string | null, name?: string) => Promise<string>;
  deleteNode: (path: string) => Promise<void>;
  deleteSelected: () => Promise<void>;
  moveNode: (from: string, toParent: string) => Promise<void>;
  moveSelected: (toParent: string) => Promise<void>;
  applyFsEvent: (event: FsChangeEvent) => void;
  setFilter: (filter: string) => void;
}
```

### 3.3 펼침 상태 지속성

```ts
// localStorage key: 'munix:tree:expanded:{vault_name}'
// 저장: expandedPaths를 JSON.stringify([...set])
// 로드: vault 오픈 시 복원
```

---

## 4. UI 구조

### 4.1 레이아웃

```plaintext
┌─────────────────────────────────┐
│  Sidebar (240px 고정)            │
│ ┌─────────────────────────────┐ │
│ │ [vault-name]         [ + ]  │ │ ← 헤더
│ ├─────────────────────────────┤ │
│ │ 🔍 파일 검색...             │ │ ← 필터
│ ├─────────────────────────────┤ │
│ │ ▼ 📁 projects               │ │ ← 트리
│ │    📄 foo.md                │ │
│ │    📄 bar.md                │ │
│ │ ▶ 📁 archive                │ │
│ │ 📄 readme.md                │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### 4.2 컴포넌트 계층

```plaintext
Sidebar
├── VaultHeader
│   ├── VaultName (클릭 → vault 전환 메뉴)
│   └── QuickActions ([+] 드롭다운)
├── TreeFilter
└── TreeList (가상 스크롤)
    └── TreeRow (재귀 렌더 X, flatten 리스트)
        ├── Indent (depth × 16px)
        ├── Chevron (폴더만)
        ├── Icon
        ├── Name (또는 인라인 input)
        └── RowActions (hover 시 표시)
```

### 4.3 Row 상세

각 행의 높이: **28px 고정**

```plaintext
[indent] [▶/▼] [📄/📁] [이름         ] [⋯]
    16px    16   16      flex           16
```

- hover 시 배경 `hover:bg-gray-100` (다크: `hover:bg-gray-800`)
- 선택 시 `bg-blue-100` (다크: `bg-blue-900/40`)
- 편집 모드: input이 Name 자리 교체

---

## 5. 인터랙션 상세

### 5.1 단일 클릭

- 파일: 에디터에 로드 + `selectedPath` 업데이트
- 폴더: `toggleExpand`
- 기존 다중 선택은 해제하고 클릭한 항목만 선택

### 5.1.1 다중 선택

파일 트리는 OS 파일 관리자와 같은 선택 모델을 따른다.

| 입력 | 동작 |
| --- | --- |
| Click | 단일 선택으로 교체 |
| Shift+Click | 마지막 anchor부터 클릭한 항목까지 range 선택 |
| Cmd+Click (macOS) / Ctrl+Click (Win/Linux) | 클릭한 항목 선택 토글 |
| Esc | 다중 선택 해제, 현재 포커스 항목만 유지 |
| Delete / Backspace | 선택 항목 일괄 삭제 |

정책:

- 다중 선택은 현재 flatten된 표시 순서를 기준으로 range 계산한다.
- 접힌 폴더의 숨겨진 children은 Shift range에 포함하지 않는다.
- 폴더를 선택하면 해당 폴더 자체가 선택된다. 삭제/이동 시 하위 항목은 별도로 선택하지 않아도 함께 처리된다.
- 부모 폴더와 그 하위 항목이 동시에 선택되면 작업 실행 전 하위 항목은 dedupe한다.
- rename은 다중 선택 상태에서 비활성화한다.
- 선택된 항목 수가 2개 이상이면 컨텍스트 메뉴의 제목 영역에 `"N개 항목"`을 표시한다.
- 드래그 시작 시 브라우저 기본 고스트 대신 `이름 + 개수`가 보이는 커스텀 프리뷰를 표시한다.

### 5.2 더블 클릭

- 파일: 새 탭으로 열기 (v1에서 탭 기능 없으므로 동일 동작)
- 폴더: 동일하게 toggle

### 5.3 우클릭 컨텍스트 메뉴

**파일에서:**

```plaintext
📄 [파일명]
─────────────
🔗 링크 복사
📋 경로 복사
─────────────
✏  이름 변경              F2
🗑  삭제                   Delete
─────────────
📁 파인더에서 표시
```

**다중 선택에서:**

```plaintext
N개 항목
─────────────
📋 경로 복사
─────────────
🗑  삭제                   Delete
─────────────
📁 선택 항목을 여기로 이동  (드롭 대상 폴더에서)
```

다중 선택 상태에서 단일 항목을 우클릭하면:

- 우클릭한 항목이 이미 선택 집합에 포함되어 있으면 선택 집합 유지
- 포함되어 있지 않으면 해당 항목 단일 선택으로 교체 후 메뉴 표시

**폴더에서:**

```plaintext
📁 [폴더명]
─────────────
➕ 새 파일                 Cmd+N
➕ 새 폴더                 Cmd+Shift+N
─────────────
✏  이름 변경              F2
🗑  삭제                   Delete
─────────────
📋 경로 복사
📁 파인더에서 표시
```

**빈 공간에서 (루트):**

```plaintext
➕ 새 파일 (루트에)
➕ 새 폴더 (루트에)
─────────────
🔄 새로고침
```

### 5.4 키보드 내비게이션

트리에 포커스 있을 때:

| 키 | 동작 |
| --- | --- |
| ↑ / ↓ | 이전/다음 항목으로 이동 |
| ← | 폴더: 접기, 파일: 부모로 이동 |
| → | 폴더: 펴기, 파일: (무시) |
| Enter | 파일: 열기, 폴더: toggle |
| F2 | 이름 변경 시작 |
| Delete / Backspace | 삭제 (확인 다이얼로그) |
| Cmd+N | 현재 폴더(또는 현재 파일의 부모)에 새 파일 |
| Cmd+Shift+N | 새 폴더 |
| Cmd+C | 경로 복사 |
| Esc | 필터/rename 취소 |

다중 선택 상태에서는 Delete/Backspace가 선택 집합 전체에 적용된다. 삭제 확인 문구는 단일 항목명 대신 `"N개 항목"` 기준으로 표시한다.

### 5.5 드래그 앤 드롭 이동

- 단일 항목 또는 다중 선택 항목을 드래그해 다른 폴더로 이동할 수 있다.
- 드래그 프리뷰는 `문서명` 또는 `문서명 외 N개` 형태로 표시한다.
- 드롭 대상이 현재 이동 중인 항목 자체이거나, 폴더를 자기 하위 폴더로 옮기려는 경우는 금지한다.
- 같은 이름의 대상이 이미 존재하면 replace/cancel 확인을 띄운다.
- 다중 이동에서 이동 대상끼리 같은 최종 경로를 만들면 자동 overwrite하지 않고 작업을 중단한다.
- replace를 선택하면 기존 대상은 먼저 삭제한 뒤 이동을 수행한다.

### 5.5 인라인 이름 변경

1. F2 또는 우클릭 → 이름 변경
2. 이름 부분이 `<input>`으로 교체, 텍스트 전체 선택 (확장자 제외)
3. 입력 중:
   - 유효성 실시간 검증 (금지 문자, 중복)
   - 에러 시 input 아래 빨간 텍스트
4. 종료:
   - Enter: 커밋 (유효할 때만)
   - Esc: 취소
   - Blur: 커밋 시도 (유효하면)

---

## 6. 드래그 앤 드롭

### 6.1 드래그 시작

- 행을 마우스 다운 후 3px 이상 이동 시 시작
- 드래그 고스트: 반투명 아이콘 + 이름
- 유효한 드롭 위치 시각화:
  - 폴더 위: 배경 하이라이트 (해당 폴더 안으로 이동)
  - 행 경계: 2px 파란 가로선 (형제 위치로 이동 — v1에서는 형제 순서 없음 ∴ 폴더 이동만)

### 6.2 드롭 대상

- **폴더**: 그 폴더 안으로 이동
- **루트**: 사이드바 빈 공간 → vault root로 이동
- **파일 위**: 무효 (드롭 불가 표시)

### 6.3 다중 선택 드래그

다중 선택된 항목 중 하나를 드래그하면 선택 집합 전체를 이동한다.

- 드래그 고스트: 대표 항목명 + `외 N개`
- 드롭 대상은 단일 항목 이동과 동일
- 이동 전 부모/자식 중복 선택을 dedupe
- 일부 항목만 이동 실패하면 전체 롤백을 우선한다
- 같은 부모로 이동하는 항목은 no-op 처리

### 6.4 제약

- 자기 자신 또는 자기 하위로의 이동은 차단
- 이동 시 이미 같은 이름이 있으면 confirm 다이얼로그

### 6.5 외부 파일 드롭

OS에서 파일을 드래그해서 vault에 넣는 경우:

- `.md` 파일: 해당 폴더로 복사
- 이미지 파일: `assets/`로 자동 복사, 에디터 열려있으면 삽입 제안
- 기타: 무시 또는 경고

---

## 7. 파일 시스템 이벤트 반영

### 7.1 이벤트 수신

```ts
// src/hooks/useFileWatcher.ts
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  const unlisten = listen<FsChangeEvent>('vault:fs-changed', (e) => {
    useFileTree.getState().applyFsEvent(e.payload);
  });
  return () => { unlisten.then(fn => fn()); };
}, []);
```

### 7.2 반영 규칙

| 이벤트 | 동작 |
| --- | --- |
| created | 해당 경로의 부모를 찾아 children 추가 |
| modified | 해당 파일의 modified/size만 업데이트 |
| deleted | 해당 노드 제거. 현재 선택 중이면 에디터 "파일 없음" 표시 |
| renamed | 기존 노드 제거 + 새 노드 추가 (펼침 상태 유지) |

### 7.3 디바운스

여러 이벤트가 150ms 내에 연속 오면 병합 (Rust 쪽에서 이미 디바운스하지만 UI도 안전장치).

### 7.4 자기 자신이 쓴 이벤트

- 자동 저장이 emit한 modified 이벤트는 필요 없음
- 구현: 저장 직전 `selfOriginatedPaths: Set<string>` 에 path 추가, 이벤트 수신 시 해당 path는 무시 + set에서 제거

---

## 8. 필터 (즉시 검색)

### 8.1 동작

- 입력하면 실시간으로 트리 필터링
- 매칭되는 파일을 포함하는 모든 상위 폴더 자동 펼침
- 매칭 문자 하이라이트 (굵게)

### 8.2 매칭 규칙

- 대소문자 무시
- fuzzy 아님, substring 매치 (v1.1에서 fuzzy 추가 검토)
- 폴더명도 매칭 대상 (폴더명 매치 시 하위 전체 표시)

### 8.3 UI

- 검색 중: 빈 결과 시 "일치하는 파일 없음" 표시
- Clear 버튼 (ⓧ) 우측 표시
- Esc 키로 클리어

---

## 9. 가상 스크롤

### 9.1 임계치

- 노드 수 ≥ 200 → 가상 스크롤 활성화
- `react-virtuoso`의 `Virtuoso` 컴포넌트 사용

### 9.2 Flatten 렌더

트리 → 펼쳐진 것만 flatten 리스트로 변환:

```ts
function flattenTree(
  nodes: FileNode[],
  expanded: Set<string>,
  filter: string,
  depth = 0,
): FlatNode[] {
  const result: FlatNode[] = [];
  for (const node of nodes) {
    const matches = filter === '' || node.name.toLowerCase().includes(filter.toLowerCase());
    // ... filter 로직
    result.push({ ...node, depth });
    if (node.kind === 'directory' && expanded.has(node.path) && node.children) {
      result.push(...flattenTree(node.children, expanded, filter, depth + 1));
    }
  }
  return result;
}
```

### 9.3 메모이제이션

- `flattenTree` 결과를 `useMemo`로 캐싱
- 의존성: `nodes`, `expanded`, `filter`

---

## 10. 빈 상태

### 10.1 Vault 없음

```plaintext
┌─────────────────────────┐
│                         │
│       📁                │
│  아직 Vault가 없어요      │
│                         │
│  [ 폴더 선택 ]            │
│  [ 새 Vault 만들기 ]      │
│                         │
└─────────────────────────┘
```

### 10.2 빈 Vault

```plaintext
┌─────────────────────────┐
│                         │
│       ✨                 │
│  첫 노트를 만들어 보세요   │
│                         │
│  [ + 새 노트 ]            │
│                         │
└─────────────────────────┘
```

---

## 11. 에러 처리

| 상황 | 처리 |
| --- | --- |
| list_files 실패 | 에러 상태 표시 + 재시도 버튼 |
| rename 충돌 | 토스트 "이미 이름이 존재합니다" |
| 삭제 중 파일 잠김 | 토스트 "삭제할 수 없습니다: {reason}" |
| 이동 중 경로 오류 | 롤백 + 토스트 |
| 다중 삭제 일부 실패 | 실패 항목 수와 첫 번째 reason 표시, 성공 항목은 트리에서 제거 |
| 다중 이동 일부 실패 | 전체 롤백 우선, 불가능하면 실패 항목을 명시 |
| 매우 깊은 트리(&gt;50) | 경고 + 성능 저하 알림 |

---

## 12. 테스트 케이스

### 12.1 단위

- [ ] `flattenTree` with expanded 조합

- [ ] 필터 매칭 로직

- [ ] 경로 정규화 (Windows `\` ↔ `/`)

- [ ] Shift range 선택: 접힌 폴더 children 제외

- [ ] 부모/자식 중복 선택 dedupe

### 12.2 통합

- [ ] 1,000 노드 트리 렌더 시간

- [ ] 외부에서 파일 추가 → 즉시 반영

- [ ] 이름 변경 → 에디터에 열린 파일이 그 파일이면 에디터도 갱신

### 12.3 E2E

1. 새 폴더 생성 → 그 안에 새 파일 → 이름 변경 → 내용 입력 → 다른 폴더로 이동 → 삭제
2. 외부 편집기로 파일 추가 → Munix에서 즉시 표시
3. 500개 파일 있는 vault 열기 → 스크롤 성능 확인
4. Shift+Click으로 5개 항목 선택 → Delete → 5개 모두 휴지통 이동
5. Cmd/Ctrl+Click으로 떨어진 항목 3개 선택 → 폴더로 드래그 → 모두 이동

---

## 13. 엣지 케이스

- **루트에 파일이 너무 많음**: 가상 스크롤로 대응
- **이름에 공백만**: 트림 후 빈 문자열이면 에러
- **같은 이름 다른 대소문자 (macOS)**: 기본적으로 허용 안 함 (경고)
- **심볼릭 링크**: 아이콘에 ↪ 표시 (v1.1+)
- **매우 긴 이름 (200자)**: 행에서 ellipsis, hover tooltip 전체 표시
- **부모와 자식 동시 선택**: 부모 작업만 수행, 자식 중복 작업 제거
- **가상 스크롤 중 range 선택**: DOM에 없는 행도 flatten list 기준으로 선택
- **필터 적용 중 선택**: 표시 중인 결과만 range 선택, 필터 해제 후에도 선택 상태 유지

---

## 14. 오픈 이슈

1. **정렬 순서 커스터마이즈**: 사용자가 수동으로 순서 조정할 수 있게 할지 (`.munix/order.json`)
2. **폴더 색상/아이콘**: 사용자 지정 가능하게 할지
3. **탭 기반 멀티 파일 열기**: v1.1+에서 결정
4. **즐겨찾기(Pin)**: v1.1+
5. **휴지통 뷰**: `.munix/.trash/` 폴더를 UI에 노출할지

---

## 15. 다음 세션 작업 메모

현재 구현 기준으로는 다중 선택, 드래그 이동, 중복 경로 차단, replace/cancel 확인까지 들어갔다. 다음 세션에서는 아래를 이어서 다루면 된다.

- [ ] 드래그 중 현재 목적지 폴더를 더 선명하게 하이라이트

- [ ] replace/cancel을 `window.confirm` 대신 전용 다이얼로그로 교체

- [ ] 다중 이동 실패 시 부분 성공/롤백 정책을 더 엄격하게 정리

- [ ] 선택 상태를 폴더 접힘/펼침, 필터 변경과 함께 더 안정적으로 유지

- [ ] 다중 선택 UX를 명령 팔레트와 키보드 단축키까지 확장할지 결정

---

**문서 버전:** v0.1 **작성일:** 2026-04-25 **관련 문서:**

- [vault-spec.md](./vault-spec.md)
- [keymap-spec.md](./keymap-spec.md)