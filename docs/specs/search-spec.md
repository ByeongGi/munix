# Search 상세 설계 — Munix

> 파일명 빠른 열기(Quick Open) + 전문 검색(Full-text Search). 점진적 고도화.

---

## 1. 목적

- 수많은 노트에서 원하는 내용을 빠르게 찾기
- 키보드만으로 파일 열기 (Cmd+P)
- 본문 내용까지 검색 (Cmd+Shift+F)

---

## 2. 단계적 로드맵

| 단계 | 포함 | 기술 |
|------|------|------|
| **v1.0** | 파일명 fuzzy 검색만 | `fuse.js` (JS, 인메모리) |
| **v1.1** | 전문 검색 (제목+본문) | `MiniSearch` (JS, 인메모리) |
| **v1.2** | 대용량 최적화 | `Tantivy` (Rust, 디스크 인덱스) |
| **v2.0** | 의미 검색 (AI) | 임베딩 + 로컬 벡터 DB |

본 문서는 v1.0 + v1.1 범위 설계.

---

## 3. Quick Open (파일명 검색)

### 3.1 트리거

- `Mod+P` 단축키
- 커맨드 팔레트에서 prefix 없이 입력

### 3.2 UI

```
┌─────────────────────────────────────────┐
│  📄  파일명으로 검색...                  │
│  ──────────────────────────────────────  │
│  📄 projects/foo.md                     │ ← 하이라이트된 매치
│     📁 projects    수정: 3일 전          │
│  ──────────────────────────────────────  │
│  📄 foo-bar.md                          │
│     📁 root        수정: 1주 전          │
│  ──────────────────────────────────────  │
│  ...                                    │
│  ──────────────────────────────────────  │
│  ↑↓ 이동  ↵ 열기  ⎋ 닫기                │
└─────────────────────────────────────────┘
```

- 크기: 폭 640px, 최대 높이 420px
- 위치: 화면 상단 중앙 (top: 15%)
- 입력 즉시 매칭, 최대 50개 표시

### 3.3 매칭 알고리즘

**Fuse.js 설정:**
```ts
const fuse = new Fuse(files, {
  keys: [
    { name: 'name', weight: 0.7 },
    { name: 'path', weight: 0.3 },
  ],
  threshold: 0.4,        // 0=엄격, 1=느슨
  distance: 100,
  includeMatches: true,  // 하이라이트용
  ignoreLocation: true,
});
```

### 3.4 정렬 우선순위

동점 처리:
1. 매칭 스코어 (낮을수록 좋음)
2. 최근 수정된 파일 우선
3. 최근 열람 파일 우선 (Recent 리스트와 교차)

### 3.5 하이라이트

매칭된 문자에 `<mark>` (굵게 + 색):

```tsx
function Highlight({ text, matches }: { text: string; matches: number[][] }) {
  // matches: [[start, end], ...]
  // 문자열을 매치/비매치로 나눠 span 감싸기
}
```

### 3.6 키 조작

| 키 | 동작 |
|---|---|
| `↑` / `↓` | 이전/다음 |
| `Enter` | 현재 파일 열기 |
| `Mod+Enter` | (v1.1+) 새 탭에 열기 |
| `Alt+Enter` | 파일 경로 복사 |
| `Esc` | 닫기 |

---

## 4. Command Palette

### 4.1 트리거

- `Mod+K`

### 4.2 Prefix 문법

| Prefix | 모드 |
|--------|------|
| `>` (기본) | 명령어 |
| `(없음)` | 파일 검색 (Quick Open과 동일) |
| `#` | 태그 |
| `@` | 현재 파일 헤딩 |
| `:` | 라인 번호 (예: `:42`) |
| `[[` | (v1.1+) 백링크 |

### 4.3 명령어 레지스트리

```ts
interface Command {
  id: string;
  title: string;
  keywords: string[];
  keybinding?: string;
  group: string;
  run: () => void | Promise<void>;
  isAvailable?: () => boolean;
}

// 예시
const commands: Command[] = [
  { id: 'file.new', title: '새 노트', keybinding: 'Mod+N', group: '파일', run: ... },
  { id: 'vault.open', title: 'Vault 열기', keybinding: 'Mod+O', group: '파일', run: ... },
  { id: 'view.toggle-sidebar', title: '사이드바 토글', keybinding: 'Mod+\\', group: '보기', run: ... },
  { id: 'theme.toggle-dark', title: '다크 모드 토글', group: '보기', run: ... },
  // ...
];
```

### 4.4 UI 특징

- 헤딩 모드 (`@`): 현재 열린 파일의 H1~H6 리스트
- 라인 이동 (`:42`): 현재 파일의 42번째 줄로 스크롤
- 그룹 헤더 표시 (파일 / 보기 / 편집 등)

---

## 5. 전문 검색 (v1.1)

### 5.1 트리거

- `Mod+Shift+F`
- 사이드바 헤더의 🔍 아이콘

### 5.2 UI — 전용 패널

사이드바를 대체하는 검색 패널:

```
┌─────────────────────────────────┐
│  🔍 전체 검색              [ × ] │
│ ─────────────────────────────── │
│  [검색어 입력                 ] │
│  □ 대소문자 구분                │
│  □ 정규식                       │
│ ─────────────────────────────── │
│  12개 파일에서 37건 일치         │
│                                 │
│  📄 projects/foo.md (3)         │
│    ...이 문장에 **검색어**가...  │
│    ...또 다른 **검색어** 매치... │
│                                 │
│  📄 notes/bar.md (1)            │
│    **검색어**가 여기에 있어요... │
│                                 │
│  ...                            │
└─────────────────────────────────┘
```

### 5.3 결과 클릭

- 결과 클릭 → 에디터에 해당 파일 열기 + 해당 줄로 스크롤 + 매치 하이라이트

### 5.4 옵션

- **대소문자 구분** (기본 OFF)
- **정규식** (기본 OFF) — 안전하게 제한된 regex
- **전체 단어만** (v1.2+)
- **폴더 필터** (v1.2+)

---

## 6. 인덱스 설계 (v1.1 MiniSearch)

### 6.1 인덱스 구조

```ts
interface IndexDocument {
  id: string;        // rel_path
  title: string;     // frontmatter.title || 파일명
  body: string;      // 본문 (frontmatter 제외)
  tags: string[];    // #tag 추출
  path: string;      // 폴더 경로
}

const miniSearch = new MiniSearch({
  fields: ['title', 'body', 'tags'],
  storeFields: ['title', 'path', 'tags'],
  searchOptions: {
    boost: { title: 2, tags: 1.5 },
    fuzzy: 0.2,
    prefix: true,
  },
});
```

### 6.2 인덱스 빌드

**초기 빌드 (vault 오픈 시):**
```ts
async function buildIndex() {
  const files = await invoke('list_files');
  const mdFiles = flatten(files).filter(f => f.kind === 'file');

  const docs = await Promise.all(mdFiles.map(async f => {
    const { content } = await invoke('read_file', { rel_path: f.path });
    const { frontmatter, body } = parseDocument(content);
    const tags = extractTags(body);
    return {
      id: f.path,
      title: frontmatter?.title ?? f.name.replace('.md', ''),
      body: stripMarkdown(body),  // MD 문법 제거
      tags,
      path: f.path,
    };
  }));

  miniSearch.addAll(docs);
}
```

**증분 업데이트 (파일 변경 시):**
```ts
// vault:fs-changed 이벤트 수신
function updateIndex(event: FsChangeEvent) {
  for (const path of event.paths) {
    if (event.kind === 'deleted') {
      miniSearch.discard(path);
    } else {
      // 재인덱싱
      const doc = await fetchDoc(path);
      miniSearch.replace(doc);
    }
  }
}
```

### 6.3 인덱스 지속성

- 기본: 메모리만 (앱 재시작 시 재빌드)
- 1,000+ 파일: localStorage에 직렬화 저장 (MiniSearch의 `toJSON()`)
- 10,000+: Tantivy (v1.2)

### 6.4 MD 텍스트 정제

검색 인덱스에 넣기 전 본문 정제:

```ts
function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')          // 코드 블록 제거
    .replace(/`([^`]+)`/g, '$1')               // inline code
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')  // 이미지 → alt
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // 링크 → 텍스트
    .replace(/[#*_~>]/g, ' ')                   // 포맷 문자
    .replace(/\s+/g, ' ')
    .trim();
}
```

### 6.5 태그 추출

```ts
const TAG_REGEX = /(?:^|\s)#([a-zA-Z0-9가-힣_][a-zA-Z0-9가-힣_-]*)/g;

function extractTags(text: string): string[] {
  const tags = new Set<string>();
  let m;
  while ((m = TAG_REGEX.exec(text)) !== null) {
    tags.add(m[1]);
  }
  return [...tags];
}
```

---

## 7. 스니펫 생성

### 7.1 컨텍스트 추출

매치 위치 ±40자 전후 표시:

```ts
function makeSnippet(body: string, term: string, maxLen = 80): string {
  const idx = body.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return body.slice(0, maxLen) + '...';
  const start = Math.max(0, idx - 40);
  const end = Math.min(body.length, idx + term.length + 40);
  return (start > 0 ? '...' : '') + body.slice(start, end) + (end < body.length ? '...' : '');
}
```

### 7.2 하이라이트

매치된 부분만 `<mark>`로 감싸기. 여러 매치는 최대 3개까지 표시.

---

## 8. 성능 예산

| 시나리오 | 목표 |
|---------|------|
| Quick Open (100 파일) | 입력 후 16ms 이내 결과 |
| Quick Open (5,000 파일) | 50ms |
| 전문 검색 (1,000 파일) | 100ms |
| 전문 검색 (10,000 파일) | 300ms (Tantivy 필요) |
| 초기 인덱스 빌드 (1,000 파일, 100KB 평균) | 1.5s |

- 인덱스 빌드 중 UI 블록 방지 (Web Worker 또는 setTimeout 청크)

---

## 9. v1.2 Tantivy 마이그레이션 설계

### 9.1 이유

- 파일 수 5,000+ 시 JS 메모리 부담
- 디스크 기반 인덱스로 앱 시작 속도 유지
- 한국어 형태소 분석기(`lindera-tantivy`) 활용

### 9.2 Rust 측 API

```rust
#[tauri::command]
async fn search_index_rebuild(state: State<'_, AppState>) -> Result<(), SearchError>;

#[tauri::command]
async fn search_query(query: String, limit: usize, state: State<'_, AppState>)
    -> Result<Vec<SearchHit>, SearchError>;

#[derive(Serialize)]
struct SearchHit {
    path: String,
    title: String,
    score: f32,
    snippets: Vec<String>,
}
```

### 9.3 인덱스 위치

`{vault}/.munix/index/` (Tantivy가 자체 관리)

---

## 10. 에러 처리

| 상황 | 처리 |
|------|------|
| 인덱스 빌드 중 파일 읽기 실패 | 해당 파일 스킵, 경고 로그 |
| 검색 쿼리 regex 오류 | "유효하지 않은 패턴" 표시 |
| 대용량 파일 (>10MB) | 본문 인덱스 스킵, 제목만 |
| 인덱스 저장 실패 | 메모리 검색으로 폴백 |

---

## 11. 테스트 케이스

### 11.1 Quick Open

- [ ] "foo" 입력 → foo.md 가장 위
- [ ] "프" 입력 → 한글 fuzzy 매칭
- [ ] 매칭 하이라이트 정확성
- [ ] 최근 열람 파일 우선 정렬

### 11.2 전문 검색

- [ ] 제목 매치가 본문 매치보다 상위
- [ ] 태그 `#project` 검색 → tags 필드 매치
- [ ] 코드 블록 내 텍스트는 제외되는지
- [ ] 한글 형태소 (v1.2): "검색한다" → "검색" 매치

### 11.3 인덱스 동기화

- [ ] 파일 추가 → 즉시 검색 가능
- [ ] 파일 삭제 → 결과에서 제외
- [ ] 파일 수정 → 최신 내용으로 매치

---

## 12. 엣지 케이스

- **대용량 파일 (10MB+)**: 인덱스에서 제외 또는 제목만
- **동일 내용 파일**: path로 구분
- **중국어/일본어**: v1.1까지는 fallback (영어 토크나이저), v1.2에서 CJK 지원
- **이모지 검색**: 원본 유지, 검색어에도 그대로
- **특수문자만**: 최소 2자 이상 입력 필수

---

## 13. 오픈 이슈

1. **인덱스 저장 포맷**: v1.1에서 localStorage vs IndexedDB (용량 한계)
2. **백링크 검색**: `[[wikilink]]` 문법 파싱 (v1.2)
3. **결과 캐싱**: 동일 쿼리 반복 시 캐시 히트 전략
4. **정규식 안전성**: ReDoS 방어 (입력 길이 제한)
5. **사용자 검색 히스토리**: 저장 여부 (프라이버시 vs 편의)

---

**문서 버전:** v0.1
**작성일:** 2026-04-25
**관련 문서:**
- [file-tree-spec.md](./file-tree-spec.md)
- [keymap-spec.md](./keymap-spec.md)
