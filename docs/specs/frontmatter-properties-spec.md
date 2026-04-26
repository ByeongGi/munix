# Frontmatter Properties 상세 설계 — Munix

> Obsidian 호환 속성(Properties) 시스템. 타입 메타데이터 영속화 + 타입별 위젯 + 우클릭 메뉴.

관련: [ADR-028](../decisions.md#adr-028-frontmatter-속성-타입은-obsidian-obsidiantypesjson-호환)

---

## 1. 목적

- 각 frontmatter 키에 명시적 타입을 부여 (Obsidian 동작과 동등)
- 타입에 맞는 입력 위젯 제공 (chip / date picker / checkbox 등)
- vault 단위 타입 메타를 `.obsidian/types.json` 에 영속화 → Obsidian 과 라운드트립 호환

## 2. 요구사항

### 2.1 기능 요구사항

| ID | 요구사항 | 우선순위 |
|---|---|---|
| FMP-01 | `.obsidian/types.json` 읽기/쓰기 (vault open 시 로드) | P0 |
| FMP-02 | 타입 미지정 시 `fieldKind` 휴리스틱으로 자동 추론 | P0 |
| FMP-03 | 우클릭 → "속성 유형" 서브메뉴로 타입 변경 | P0 |
| FMP-04 | 타입별 위젯: text / multitext / number / checkbox / date / datetime / tags / aliases | P0 |
| FMP-05 | 태그 chip 입력 + TagIndex 기반 자동완성 | P0 |
| FMP-06 | 우클릭 → 잘라내기/복사/붙여넣기 (값 기준) | P1 |
| FMP-07 | 우클릭 → 삭제 | P0 |
| FMP-08 | 외부에서 `.obsidian/types.json` 수정 시 핫 리로드 | P1 |
| FMP-09 | 키보드 네비게이션: Tab으로 다음 필드 / Esc로 편집 취소 | P1 |
| FMP-10 | 타입 아이콘 (lucide) 표시 | P0 |
| FMP-11 | 알려지지 않은 타입은 `text` 로 폴백 (Obsidian 미래 호환) | P0 |
| FMP-12 | 타입 변경 시 기존 값 변환 시도 (실패하면 그대로 유지하되 표시 경고) | P1 |

### 2.2 비기능 요구사항

- 타입 메타 로드: vault open 후 < 50ms
- 위젯 렌더: 50개 필드 < 16ms
- 자동완성 응답: 타이핑 → 결과 표시 < 50ms

---

## 3. 데이터 모델

### 3.1 타입 vocabulary (Obsidian 호환)

```ts
// src/types/frontmatter.ts
export type PropertyType =
  | "text"        // 기본
  | "multitext"   // 일반 list
  | "number"
  | "checkbox"
  | "date"        // YYYY-MM-DD
  | "datetime"    // YYYY-MM-DDTHH:mm
  | "tags"        // 특수 multitext: TagIndex 자동완성
  | "aliases";    // 특수 multitext

export interface PropertyTypesFile {
  types: Record<string, PropertyType>;
}
```

### 3.2 한글 라벨 (i18n)

```json
// public/locales/ko/properties.json
{
  "types": {
    "text": "텍스트",
    "multitext": "목록",
    "number": "숫자",
    "checkbox": "체크박스",
    "date": "날짜",
    "datetime": "날짜 및 시간",
    "tags": "태그",
    "aliases": "별칭"
  },
  "menu": {
    "type": "속성 유형",
    "cut": "잘라내기",
    "copy": "복사",
    "paste": "붙여넣기",
    "delete": "삭제"
  }
}
```

### 3.3 타입 아이콘 매핑 (lucide-react)

| 타입 | 아이콘 |
|---|---|
| `text` | `Text` |
| `multitext` | `List` |
| `number` | `Hash` |
| `checkbox` | `CheckSquare` |
| `date` | `Calendar` |
| `datetime` | `Clock` |
| `tags` | `Tag` |
| `aliases` | `Link2` |

---

## 4. 영속화

### 4.1 파일 위치

`{vault}/.obsidian/types.json`

### 4.2 파일 포맷

```json
{
  "types": {
    "tags": "tags",
    "created": "datetime",
    "due": "date",
    "rating": "number",
    "draft": "checkbox"
  }
}
```

- 모르는 키는 보존 (spread merge로 overwrite 방지)
- 모르는 타입 값은 무시 (UI는 fallback `text`로 처리, 파일에는 원본 보존)
- 들여쓰기 2 spaces, trailing newline (Obsidian과 동일)

### 4.3 IPC

```ts
// src/types/ipc.ts 추가
interface PropertyTypeMap { [field: string]: PropertyType }

// Tauri commands
load_property_types() -> Result<PropertyTypeMap, VaultError>
save_property_types(types: PropertyTypeMap) -> Result<(), VaultError>
```

Rust 측: `vault::types_path()` = `vault.root().join(".obsidian/types.json")`. 디렉터리 없으면 `save` 시 `create_dir_all`. 읽기 실패(파일 없음)는 빈 객체 반환.

### 4.4 Store

```ts
// src/store/property-types-store.ts
interface PropertyTypesStore {
  types: Record<string, PropertyType>;
  status: "idle" | "loading" | "ready" | "error";
  load: (vaultRoot: string) => Promise<void>;
  setType: (field: string, type: PropertyType) => Promise<void>;
  reload: () => Promise<void>;  // watcher에서 호출
  // 휴리스틱 폴백 포함된 lookup
  resolve: (field: string, value: unknown) => PropertyType;
}
```

### 4.5 Watcher

`.obsidian/types.json` 변경 이벤트 (외부 수정 = Obsidian) → `propertyTypesStore.reload()`.
자기 쓰기는 기존 `record_write` + 1500ms suppression 적용 (ADR-021).

---

## 5. 휴리스틱 폴백 (`resolve`)

`types.json`에 키 없을 때 추론 순서:

```ts
function resolve(field: string, value: unknown): PropertyType {
  // 1. 키 이름 특수 처리
  if (field === "tags" || field === "tag") return "tags";
  if (field === "aliases" || field === "alias") return "aliases";
  
  // 2. 값 typeof
  if (typeof value === "boolean") return "checkbox";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "multitext";
  
  // 3. 키 이름 정규식 (날짜류)
  if (/^(date|created|updated|modified|published|due|deadline|start|end)$/i.test(field)) {
    if (typeof value === "string" && /T\d{2}:/.test(value)) return "datetime";
    return "date";
  }
  
  // 4. 값 모양 (ISO date)
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return "datetime";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date";
  }
  
  return "text";
}
```

휴리스틱 결과는 `types.json`에 기록하지 않음 — 사용자가 명시적으로 우클릭 → 타입 변경한 경우만 기록.

---

## 6. 위젯 사양

각 위젯은 props `{ value, onCommit, autoFocus? }` 받음. `onCommit(parsedValue, flush)` 형태.

### 6.1 TextWidget
```tsx
<input type="text" value={draft} ... />
```
- onChange: 디바운스 저장
- onBlur: flush 저장

### 6.2 MultitextWidget (chip 입력, tags/aliases 동일 베이스)
```
[chip1 ×] [chip2 ×] [chip3 ×] |____input____|
```
- 칩 클릭 시 × 표시 (호버 또는 항상)
- input에 입력 후 `,` / Enter / Tab → chip 추가
- input 비어있을 때 Backspace → 마지막 chip 삭제
- Esc → 입력 중단 + draft 폐기
- chip 드래그로 순서 변경 (P2)
- `tags` 타입: TagIndex에서 prefix 매칭 자동완성 드롭다운

### 6.3 NumberWidget
```tsx
<input type="number" inputMode="decimal" ... />
```
- 빈 문자열 → `null` (필드 자체는 보존)
- 파싱 실패 → 직전 값 유지

### 6.4 CheckboxWidget
```tsx
<button role="switch" aria-checked={...}>...</button>
```
현재 `FieldInput`의 boolean 토글 그대로.

### 6.5 DateWidget
```tsx
<DatePickerPopover withTime={false} ... />
```
- `value`는 `YYYY-MM-DD` 문자열만 받음 (Date 객체 → ISO date로 변환)
- 빈 문자열 → 필드 보존, 값만 비움
- 값 입력 필드는 텍스트 입력을 허용하되, 클릭/포커스 시 `react-datepicker` 기반 inline calendar popover 를 연다.
- popover 는 `Set` / `Cancel` 흐름을 사용한다. 달력에서 선택한 값은 draft 로만 유지하고 `Set` 클릭 시 저장한다.

### 6.6 DatetimeWidget
```tsx
<DatePickerPopover withTime ... />
```
- `value`는 `YYYY-MM-DDTHH:mm` 문자열
- 직렬화 시 ISO 8601 (`+09:00` 같은 타임존은 보존하지 않음 — Obsidian 동작과 일치)
- Date / Time 탭을 분리한다. Date 탭은 `react-datepicker` inline calendar 를 사용하고, Time 탭은 Hour / Minute 컬럼 선택 UI 를 사용한다.
- 시간은 분 단위까지 선택 가능해야 한다. `Set` 클릭 전까지는 draft 상태이며, `Cancel` 또는 외부 클릭 시 저장하지 않고 닫는다.

---

## 7. 우클릭 컨텍스트 메뉴

### 7.1 메뉴 구조

```
[속성 유형] →  ✓ 텍스트
              목록
              숫자
              체크박스
              날짜
              날짜 및 시간
              ──────
              태그        (필드명이 'tags'/'tag'일 때만 노출)
              별칭        (필드명이 'aliases'/'alias'일 때만 노출)
─────────
잘라내기      (Cmd+X)
복사          (Cmd+C)
붙여넣기      (Cmd+V)
─────────
삭제          (Backspace)
```

### 7.2 동작

- **속성 유형 변경**: `setType(field, newType)` → `types.json` 갱신 + 위젯 재렌더 + 기존 값 변환 시도
  - 변환 규칙:
    | from → to | 동작 |
    |---|---|
    | text → number | `Number(v)`, NaN이면 원본 유지 + 토스트 |
    | text → checkbox | `v === "true"` |
    | text → multitext | `v.split(",").map(trim).filter(Boolean)` |
    | text → date/datetime | ISO 매칭하면 사용, 아니면 빈 값 |
    | multitext → text | `v.join(", ")` |
    | * → 자기 자신 | no-op |
- **잘라내기**: 클립보드에 `JSON.stringify(value)` + 필드 삭제
- **복사**: 클립보드에 `JSON.stringify(value)`
- **붙여넣기**: 클립보드 → `JSON.parse` 시도, 실패하면 raw 문자열을 현재 타입으로 파싱
- **삭제**: `setFrontmatter` 에서 키 제거 (현재 `removeField` 그대로)

### 7.3 키보드 단축키

필드 행에 포커스 있을 때:
- `Backspace` / `Delete` → 삭제 (값이 비어있는 경우만, 채워진 값은 input의 backspace 우선)
- `Cmd+C/X/V` → 위 동작 (브라우저 기본 키바인딩 가로채지 않고 행 단위 액션은 우클릭으로만)

---

## 8. UI 레이아웃

```
┌─────────────────────────────────────────────────┐
│  속성                                            │
│                                                  │
│  🏷  tags     [frontend ×] [react ×] |____|     │
│  ↗  aliases   |____________|                    │
│  📅 created   [2026-04-25 ▼]                    │
│  🕒 remind    [2026-04-25T14:30 ▼]              │
│  ☐  draft     [○]                                │
│  #  rating    [5]                                │
│                                                  │
│  + 속성 추가                                     │
└─────────────────────────────────────────────────┘
```

- 첫 컬럼: 타입 아이콘 (16px, `text-tertiary`)
- 둘째 컬럼: 키 이름 (mono font, hover 시 편집 가능 — P1)
- 셋째 컬럼: 위젯 (남은 공간 fill)
- 행 hover 시: 우측에 `×` 삭제 버튼 + 우클릭 가능 표시
- 펼침/접힘 제거 (항상 노출, ADR-028 결정)
- "+ 속성 추가" 클릭 → inline 입력 row 표시. 왼쪽 type chip 클릭 시 타입 메뉴 popover 표시. 타입 선택 후 key 입력, Enter/blur 로 생성
- 새 속성 생성 시 선택 타입에 맞는 기본값을 넣고 `.obsidian/types.json` 에 타입을 기록한다.
- 속성 패널이 빈 상태(`frontmatter === {}`)일 때 패널 컨테이너 포커스 후 Backspace/Delete 로 패널 전체 삭제 가능. 입력 필드 안 Backspace 는 입력 삭제가 우선한다.

---

## 9. 마이그레이션

### 9.1 기존 vault

- `.obsidian/types.json` 없으면 빈 상태로 시작 → 휴리스틱으로 동작
- 사용자가 첫 우클릭 타입 변경 시 `.obsidian/` 디렉터리 + `types.json` 생성

### 9.2 Obsidian에서 만든 vault

- 이미 있는 `.obsidian/types.json` 그대로 로드
- 모르는 타입은 `text` 폴백 (UI만), 파일은 원본 유지

### 9.3 양방향 호환

- Munix가 기록한 `.obsidian/types.json` → Obsidian이 그대로 인식
- Obsidian이 기록한 `.obsidian/types.json` → Munix가 그대로 인식
- watcher로 외부 변경 감지 → 자동 reload

---

## 10. 엣지케이스

| 상황 | 동작 |
|---|---|
| `.obsidian/types.json` 가 잘못된 JSON | console.warn + 빈 객체로 폴백, 파일은 건드리지 않음 |
| 타입 vocabulary 외 값 (예: `"image"`) | UI는 `text` 폴백, 파일에 원본 보존 |
| 타입 변경 후 값 변환 실패 (number 변환 NaN) | 원본 값 유지, 토스트로 알림 |
| 빈 vault (frontmatter 없음) | 패널은 "+ 속성 추가" 버튼만 표시 |
| 빈 속성 패널 (`{}`) | 헤더 X 또는 패널 포커스 후 Backspace/Delete 로 `frontmatter=null` 삭제 |
| `.obsidian/` 가 파일로 존재 (디렉터리 아님) | 에러 표시, 사용자에게 수동 해결 요청 |
| Obsidian이 동시 실행 중 | watcher로 변경 감지 → 충돌 시 마지막 쓰기 우선 (Obsidian 정책 따름) |
| chip 입력에 매우 긴 문자열 | 100자 제한, 잘라냄 |
| `tags` 필드 중복 값 | chip 추가 시 dedupe |

---

## 11. `---` 입력 트리거 (Obsidian 호환)

> ADR-029 참조. Obsidian의 frontmatter 진입 입력 방식을 그대로 따른다.

### 11.1 동작 규칙

**트리거 시점이 비대칭** (Obsidian과 동일):

| 위치 | 입력 | 시점 | 동작 |
|---|---|---|---|
| 문서 시작 AND frontmatter 없음 AND 라인 비어있음 | `---` | 3번째 `-` 입력 즉시 (Enter 불필요) | frontmatter 생성, 속성 패널 포커스, 3개 dash는 소비/제거 |
| 그 외 모든 위치 | `---` + Enter | Enter 키 입력 시 | HR (수평선) 삽입 |
| frontmatter 이미 존재 | `---` + Enter 어디서든 | Enter 시 | HR (사용자가 명시적으로 HR 원하는 경로 보장) |

핵심:
- **frontmatter 트리거는 3번째 `-` 입력 즉시** — 사용자가 별도 Enter 안 눌러도 변환됨
- **HR 트리거는 Enter 필요** — 빈 라인에서 `---` 후 Enter
- 두 동작이 위치/맥락으로만 분기되고, 키 입력 시점은 다름

### 11.2 Tiptap 구현

**frontmatter 트리거**는 InputRule (텍스트 입력 즉시 발화) 로,
**HR 트리거**는 기존 Enter 시점 패턴 유지.

```ts
// src/components/editor/extensions/frontmatter-trigger.ts
import { Extension } from "@tiptap/core";
import { textInputRule } from "@tiptap/core";

export const FrontmatterTrigger = Extension.create({
  name: "frontmatterTrigger",
  addInputRules() {
    return [
      // 문서 시작에서 `---` 3개 입력 즉시 매칭 (Enter 불필요)
      // 정규식: 라인 시작 (^) + 정확히 3개 dash
      {
        find: /^---$/,
        handler: ({ state, range, commands }) => {
          const { selection } = state;
          // 1. 문서 최상단인지 (paragraph 첫 노드 + 텍스트만 ---)
          const isDocStart = selection.$from.parent.firstChild === null
            ? selection.$from.pos <= 2
            : selection.$from.start() <= 2;
          // 2. frontmatter 미존재
          const fm = useEditorStore.getState().frontmatter;
          if (!isDocStart || fm) return null; // 매칭 안 함 → 기존 HR 동작이 Enter에서 발화
          
          // frontmatter 생성 + dash 3개 제거 + 패널 포커스
          commands.deleteRange(range);
          useEditorStore.getState().setFrontmatter({});
          useEditorStore.getState().setPendingPropertyFocus(true);
          return true;
        },
      },
    ];
  },
});
```

**HR 동작은 Enter 전용 커스텀 확장으로 처리한다.** Tiptap `HorizontalRule` 기본 input rule 은 `---` 입력 즉시 HR 로 변환되므로 비활성화한다. Munix 는 input rule 없는 `HorizontalRuleNode` 를 등록하고, `HorizontalRuleEnter` 가 현재 paragraph 의 텍스트가 정확히 `---` 이며 커서가 문단 끝에 있을 때 Enter 로만 HR 을 삽입한다.

frontmatter가 이미 있는 상태에서는 첫 조건 (`!fm`) 에서 false → frontmatter input rule 은 dash 를 소비하지 않음 → 텍스트 `---`로 남고, Enter 시 `HorizontalRuleEnter` 가 HR 을 삽입한다.

### 11.3 상태 추가

```ts
// src/store/editor-store.ts
pendingPropertyFocus: boolean;
setPendingPropertyFocus: (v: boolean) => void;
```

`PropertiesPanel`은 이 플래그를 구독해서 true가 되면 "+ 속성 추가" 입력란에 자동 포커스 + 플래그 reset.

### 11.4 엣지케이스

| 상황 | 동작 |
|---|---|
| 빈 문서에서 `---` 입력했지만 슬래시 메뉴 등으로 paragraph가 아닌 다른 노드인 경우 | 기존 HR 동작 (특수 노드 우선) |
| frontmatter 있지만 빈 객체 (`{}`)인 경우 | 두 번째 `---`는 HR (frontmatter "있음"으로 판정) |
| `---<space>` 입력 (Tiptap의 다른 트리거 문법) | 동일 규칙 적용 |
| Asterisk `***` / underscore `___` 로도 HR 가능 | 이 규칙은 `---`에만 적용. Obsidian과 동일 (`***`/`___`는 항상 HR) |
| 사용자가 frontmatter 패널에서 모든 필드 삭제 | `frontmatter`가 `null`이 됨 → 다시 `---`로 재진입 가능 |
| `---`만 입력하고 Enter를 누르지 않음 | frontmatter 조건이 아니면 텍스트 그대로 유지, HR 로 변환하지 않음 |

### 11.5 Slash 메뉴 통합

슬래시 메뉴 `/horizontal-rule` (수평선) — 위치 무관 항상 HR 삽입 (input rule 우회). 사용자가 명시적으로 HR을 원하는 경로 보장.

슬래시 메뉴에 `/properties` (속성 추가) 항목 추가 → 위치 무관 frontmatter 생성. 단축키 외 진입 경로.

### 11.6 마운트 정책 — `PropertiesPanel`은 항상 마운트 (ADR-030 준수)

**규칙:** `PropertiesPanel` 의 외곽 컨테이너 div 는 `frontmatter === null` 이어도 항상 마운트된다. 가시성은 `hidden` 클래스 + `aria-hidden` 으로만 토글한다. **절대 `return null` 로 mount/unmount 토글 금지.**

**이유:** `---` 트리거 직후 PM 의 tr commit 과 React 의 mount commit 이 같은 task tick 에 충돌 → editor-view 의 PM plugin view (BubbleMenu/DragHandle) 들이 imperative 로 만진 같은 부모 div child list 와 React reconciler 의 `insertBefore` 가 race → WebKit `NotFoundError: The object can not be found here` throw. 자세한 분석은 [decisions.md ADR-030](../decisions.md#adr-030) 참조.

**구현 패턴:**

```tsx
// ✅ 올바름
const visible = frontmatter !== null;
return (
  <div className={cn("...", !visible && "hidden")} aria-hidden={!visible}>
    {/* entries / AddProperty 는 visible 무관 항상 렌더 */}
  </div>
);

// ❌ 금지 — mount race 발생
if (frontmatter === null) return null;
```

**적용 범위:** PropertiesPanel 본체 + 향후 editor-view 자식으로 들어가는 모든 React 패널 (BlockMenu, SlashMenu 등) 도 동일 원칙. 진짜 mount/unmount 가 필요한 경우 portal 로 분리 검토.

---

## 12. 컴포넌트 분리

```
src/components/editor/properties/
├── properties-panel.tsx         # 오케스트레이터 (기존 frontmatter-panel.tsx 대체)
├── property-row.tsx              # 단일 행 (아이콘 + 키 + 위젯 + 우클릭 메뉴)
├── property-context-menu.tsx     # 우클릭 메뉴
├── type-picker-submenu.tsx       # 속성 유형 서브메뉴
├── widgets/
│   ├── text-widget.tsx
│   ├── multitext-widget.tsx     # tags / aliases 도 props로 분기
│   ├── number-widget.tsx
│   ├── checkbox-widget.tsx
│   ├── date-widget.tsx
│   └── datetime-widget.tsx
├── add-property.tsx              # "+ 속성 추가"
└── tag-autocomplete.tsx          # tags 위젯 자동완성 드롭다운
```

기존 `frontmatter-panel.tsx` 는 deprecated 표시 후 `properties-panel.tsx` 로 라우팅.

---

## 12. 구현 단계 (분리 커밋)

1. **인프라**: `PropertyType` 타입, `property-types-store`, IPC commands (`load_property_types`, `save_property_types`), Rust `vault::types`
2. **휴리스틱**: `resolve(field, value)` 함수 + 단위 테스트
3. **위젯**: 6개 위젯 컴포넌트 (chip/autocomplete 제외) + 기본 레이아웃
4. **chip 입력**: `multitext-widget` + `tag-autocomplete`
5. **우클릭 메뉴**: type picker submenu + cut/copy/paste/delete
6. **Watcher 핫리로드**: `.obsidian/types.json` 변경 감지 → store reload
7. **마이그레이션**: 기존 `frontmatter-panel.tsx` 제거 + 라우팅
8. **i18n**: `properties.json` 한/영
9. **문서**: ADR-028 status `proposed` → `accepted`, 이 spec status 갱신

---

## 13. 테스트

### 13.1 단위
- `resolve(field, value)` 휴리스틱: 25+ 케이스
- 타입 변환 (text → number, multitext → text 등): 8개 매트릭스
- `.obsidian/types.json` 파싱: 정상 / 손상 / 빈 파일 / 모르는 타입

### 13.2 통합 (수동)
- vault 열기 → `types.json` 없음 → 휴리스틱 동작
- 우클릭 → 타입 변경 → `.obsidian/types.json` 생성 확인
- Obsidian에서 같은 vault 열기 → 타입 동일하게 표시
- 외부에서 `types.json` 수정 → 핫 리로드
- chip: 추가/삭제/Backspace/`,`/Enter/Tab/Esc 모든 경로
- 자동완성: 첫 글자 → 드롭다운 → ↑↓ 선택 → Enter

### 13.3 회귀
- 기존 frontmatter 편집 정상 동작 (text, number, checkbox)
- 자동저장 + 인덱스 갱신 (ADR-027 후속)
- 충돌 다이얼로그 (ADR-021)

---

**문서 버전**: v0.1 (proposed)
**작성일**: 2026-04-25
**의존**: ADR-021 (watcher self-write), ADR-027 (js-yaml 직접 사용), ADR-028 (Obsidian types.json 호환)
