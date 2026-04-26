# Munix — 개발 중 겪은 이슈 로그

> 개발하면서 부딪힌 문제·해결·트레이드오프 기록.
> decisions.md가 "왜 이렇게 결정했지?"라면, 이 문서는 "왜 이렇게 됐고 어떻게 풀었지?".
> 새 이슈 발견 시 최상단에 추가.

---

## 로그

### 2026-04-26 — Properties `---` 트리거: NotFoundError (ProseMirror tr 충돌)

**카테고리:** Editor / ProseMirror / Properties
**관련 파일:** `components/editor/frontmatter-trigger.ts`
**관련 ADR:** [ADR-029](./decisions.md#adr-029-uxui-결정은-obsidian-사용성에-최대한-일치-hr-vs-frontmatter-입력-규칙-포함)

**증상:** 빈 문서 첫 줄에서 `---` 입력 즉시 frontmatter 트리거가 발동되면 `DOMException: NotFoundError`로 ProseMirror 트랜잭션이 폭주.

**원인:** input rule handler 내부에서 `commands.deleteRange()` + 자동저장 `flushSave()` 를 동시 호출 → 두 트랜잭션이 동일 step에 쌓이면서 prosemirror-view가 stale DOM 위치를 참조.

**해결:** input rule 안에서는 `state.tr.delete(from, to)` 로 직접 트랜잭션 구성 + frontmatter 생성 / 포커스 이동 같은 사이드이펙트는 `queueMicrotask`로 같은 task가 끝난 뒤 deferred 실행.

---

### 2026-04-26 — PropertiesPanel: Rules of Hooks 위반 (frontmatter null 전환)

**카테고리:** React / Hooks / Properties
**관련 파일:** `components/editor/properties/properties-panel.tsx`, `components/editor/properties/add-property.tsx`, `store/editor-store.ts`

**증상:** 빈 문서 → `---` 입력으로 frontmatter 생성될 때 `Warning: React has detected a change in the order of Hooks called by PropertiesPanel`. 이후 React가 컴포넌트를 unmount/remount.

**원인:** PropertiesPanel이 `frontmatter === null`이면 early return하는데 `useState`/`useEffect`가 early return 뒤에 위치 → null/non-null 전환 시 hook 호출 수가 달라짐.

**해결:** `pendingPropertyFocus` 신호를 PropertiesPanel이 들고 있던 패턴 폐기. 신호를 `useEditorStore`에 두고 AddProperty가 직접 store에서 구독 + reset → 패널 자체는 hook 없이 컴포지션.

---

### 2026-04-26 — PropertiesPanel: render-time setState (Promise.resolve 안티패턴)

**카테고리:** React / Properties
**관련 파일:** `components/editor/properties/properties-panel.tsx`

**증상:** PropertiesPanel render 함수 안에서 `Promise.resolve().then(() => setState(...))` 호출 → React 18 strict mode에서 "Cannot update a component while rendering a different component" 경고.

**원인:** render 본문에서 micro-task로 setState를 큐잉하는 안티패턴. effect dependency 회피용으로 작성했었음.

**해결:** 정상 `useEffect`로 이동 + ref 패턴(`useRef`로 prev 값 비교)으로 단순화. setState는 effect 안에서만.

---

### 2026-04-26 — 제목 디바운스 1500ms 너무 느림 (UX)

**카테고리:** UX / Editor / Title
**관련 파일:** `components/editor/editor-title-input.tsx`, `store/editor-store.ts`
**관련 ADR:** [ADR-029](./decisions.md#adr-029-uxui-결정은-obsidian-사용성에-최대한-일치-hr-vs-frontmatter-입력-규칙-포함)

**증상:** 스펙 v0.1에서 제목 입력 → 1500ms 디바운스 후 rename으로 명세. 실 동작은 매 키스트로크마다 디바운스 타이머 reset → 사용자가 입력 멈출 때까지 파일 트리 반영 안 됨 + 빠른 rename race로 stale path 남는 케이스.

**원인:** Obsidian은 디바운스 없이 blur/Enter 시점에만 rename — 명료하고 race가 없음. 디바운스는 "타이핑 도중 자동 rename"이라는 의도가 사용자 mental model과 충돌.

**해결:** 디바운스 제거. `EditorTitleInput`에서 blur 또는 Enter 키 입력 시점에만 `renameCurrent` 호출. 빈 제목 / 금지 문자 / 동일 디렉터리 충돌은 직전 값으로 revert. 스펙 v0.1 → 실 구현 NOTE 추가됨.

---

### 2026-04-26 — PropertiesPanel: frontmatter null일 때도 헤더/추가 버튼 노출

**카테고리:** UX / Properties
**관련 파일:** `components/editor/properties/properties-panel.tsx`, `components/editor/editor-view.tsx`

**증상:** frontmatter 없는 일반 노트에서도 본문 위에 "속성" 헤더 + "+ 속성 추가" 버튼이 항상 노출 → Obsidian과 다름 (Obsidian은 frontmatter 있을 때만 패널 표시).

**원인:** PropertiesPanel을 항상 렌더링하고 내부에서만 분기.

**해결:** `frontmatter === null`이면 PropertiesPanel 자체를 hide. 새 frontmatter는 `---` 트리거 또는 slash 메뉴(향후) 로만 진입.

---

### 2026-04-25 — Properties: 더블클릭이 컨텍스트 메뉴를 여는 현상

**카테고리:** UX / Properties
**관련 파일:** `components/editor/properties-panel.tsx` (예정)
**관련 ADR:** [ADR-029](./decisions.md#adr-029-properties-ux-obsidian-우선--hr-입력-규칙--제목파일명)

**증상:** Properties 행에서 더블클릭 → 우클릭 컨텍스트 메뉴가 열림. 의도는 inline edit 진입.

**원인:** `onDoubleClick`보다 `onContextMenu`(또는 native dblclick→contextmenu 전이) 가 먼저 잡히는 핸들러 순서 + WKWebView가 빠른 연속 클릭에서 secondary action으로 해석하는 케이스.

**해결:** dblclick에서 `e.preventDefault() + e.stopPropagation()` + 컨텍스트 메뉴는 명시적 우클릭(`button === 2`)에서만 열리도록 가드.

---

### 2026-04-25 — Markdown indented code block에서 `#tag`가 태그로 인덱싱됨

**카테고리:** Editor / Markdown / Index
**관련 파일:** `lib/tag-index.ts`, `lib/markdown-utils.ts`

**증상:** 4-space indented 코드 블록 안의 `#hash` 가 태그 패널에 잡힘. 본문 코드 펜스(```)는 이미 제외했으나 indented 형태는 누락.

**해결:** 인덱서가 라인 단위로 indented code block(연속 줄이 4 space 또는 tab으로 시작) 도 코드 영역으로 간주하도록 보강. fenced + indented 둘 다 스킵.

---

### 2026-04-25 — 자기 저장 직후 인덱스가 갱신되지 않음

**카테고리:** Index / Watcher / 자동저장
**관련 파일:** `hooks/use-vault-watcher.ts`, `lib/search-index.ts`

**증상:** 본문 편집 → 자동저장 → 같은 파일이 watcher로 도착하지만 `recent_writes` echo suppression에 막혀 인덱스(검색·태그·백링크)가 변경 전 상태로 유지.

**원인:** Echo suppression은 watcher → editor reload 막기 위함이지만 인덱스 갱신까지 같은 경로에서 함께 차단됨.

**해결:** 자기 저장 성공 콜백에서 인덱스(`searchIndex.updateDoc`, tag/backlink rebuild) 를 명시적으로 갱신. watcher 경로와 분리.

---

### 2026-04-25 — Frontmatter 입력 시 `,` 가 사라짐

**카테고리:** UX / Properties / IME
**관련 파일:** `components/editor/frontmatter-panel.tsx`

**증상:** tags/aliases 등 multitext 입력 중 `,` 키 → chip 분리 + 입력값 클리어 정상 동작인데, 일부 경로(특히 IME 조합 중) 에서 `,` 가 chip으로도 안 들어가고 입력에서도 사라짐.

**원인:** `onKeyDown`에서 `,` 분리 후 `e.preventDefault()` 호출하지만 IME composing(`isComposing`) 동안 한 번 더 onChange가 발화하면서 잘려나감.

**해결:** `,`/Enter/Tab 분리 핸들러에서 `e.isComposing || e.nativeEvent.isComposing` 가드. 조합 종료 후에만 chip 분리.

---

### 2026-04-25 — `gray-matter` Buffer 에러 (브라우저 환경)

**카테고리:** Build / Dependencies
**관련 파일:** `lib/markdown-utils.ts`

**증상:** 프론트에서 `matter(text)` 호출 시 `ReferenceError: Buffer is not defined`. Vite 빌드는 통과하나 런타임 폭주.

**원인:** `gray-matter`가 Node 의존성(`Buffer`) 사용. Tiptap 에디터에서 직접 호출하면 브라우저 폴리필 없는 환경에서 throw.

**해결:** `js-yaml` 직접 사용으로 교체 (ADR-027). frontmatter 추출은 `^---\n...\n---` 정규식 + `js-yaml.load`. Rust 측은 그대로 `gray_matter` 유지.

---



**카테고리:** Editor / React / ProseMirror
**관련 파일:** `components/editor/editor-view.tsx`, `@tiptap/extension-drag-handle-react`

**증상:** 슬래시 `/` 메뉴 또는 Wikilink `[[` 자동완성을 열어둔 상태에서 ~750ms (자동저장 debounce) 후 메뉴가 사라짐. 사용자가 입력을 안 했는데도 닫힘. 콘솔의 `console.debug`로 추적해보면 ProseMirror가 suggestion plugin을 destroy 함.

**원인:** `<DragHandle editor={editor} onNodeChange={({ pos }) => ...}>` JSX의 `onNodeChange` 핸들러가 inline arrow function이라 EditorView가 rerender될 때마다 새 reference. DragHandle 내부 useEffect가 props 변경에 반응해 매번 cleanup → 다시 `registerPlugin`을 호출 → ProseMirror가 `updateState`/`updatePluginViews`로 모든 plugin view를 destroy하고 다시 생성 → 슬래시/Wikilink suggestion plugin도 같이 destroy됨 → 메뉴 사라짐.

자동저장이 직접 메뉴를 닫는 게 아니라, 자동저장이 → store 업데이트 → React rerender → DragHandle props 새로 → useEffect 재발동 → plugin re-register → suggestion view destroy 라는 인과 사슬.

**진단의 결정적 단서:** suggestion의 `onExit` 콜백에 stack trace 로그를 박았을 때 다음 패턴이 보이면 이 함정:

```
onExit
destroyPluginViews
updatePluginViews
updateStateInner
registerPlugin
@tiptap/extension-drag-handle-react      ← 범인 패키지
commitHookEffectListMount                 ← React useEffect commit
```

**해결:**
1. `onNodeChange`를 `useCallback`으로 안정화
2. children button의 `onClick`도 `useCallback`로 안정화
3. `blockPos`를 useState → useRef로 변경 (UI에 직접 표시 안 되는 값이라 rerender 불필요)
4. (방어막) tippy 옵션에 `hideOnClick: false` 추가 — 외부 click으로 자동 hide되는 default 동작이 다른 trigger와 결합해 부정적으로 작용할 가능성 차단

```tsx
const blockPosRef = useRef<number | null>(null);
const handleNodeChange = useCallback(
  ({ pos }: { pos: number | null }) => { blockPosRef.current = pos },
  [],
);
const handleGripClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
  // blockPosRef.current 읽음 — state 안 거치니 rerender 없음
}, []);

<DragHandle editor={editor} onNodeChange={handleNodeChange}>
  <button onClick={handleGripClick}>...</button>
</DragHandle>
```

**교훈:** ProseMirror plugin을 register하는 React 컴포넌트 (`@tiptap/extension-*-react` 류)를 쓸 때 **props 안정성 필수**. inline arrow / inline JSX children은 거의 매 rerender마다 새 reference라 컴포넌트 내부 useEffect가 매번 cleanup → effect 재발동. ProseMirror 특성상 `updateState`는 *모든* plugin views를 destroy 후 재생성하므로, 한 plugin의 재등록이 무관한 다른 plugin (suggestion 등)에 영향. 의심 증상: "잘 동작하던 기능이 자동저장/타이머/외부 update 같은 무관 이벤트 직후 갑자기 닫히거나 reset됨". 같은 종류의 React-binding plugin을 추가할 때 props는 useCallback / useMemo / 상수로 잡아두는 패턴을 기본값으로.

---

### 2026-04-25 — Tauri 2 `dragDropEnabled`가 webview HTML5 DnD를 가로챔 ⚠️ 함정

**카테고리:** Build / DnD / Tauri
**관련 파일:** `src-tauri/tauri.conf.json`, `components/file-list.tsx`

**증상:** 파일 트리 드래그 시 `dragstart` / `dragend` 이벤트는 정상 발동하는데 그 사이의 `dragover` / `drop` 이벤트가 webview JavaScript까지 **단 한 번도 도달하지 않음**. 마우스 커서는 "이동 가능"(↗︎) 모양으로 변하지 않고 줄곧 "ignored" 상태. 결과적으로 어떤 행으로 드래그해도 파일이 이동되지 않음.

**원인:** Tauri 2 window 옵션 `dragDropEnabled`의 기본값이 `true`. `true`이면 Tauri 런타임이 OS 레벨에서 drag/drop을 가로채서 자체 이벤트(`tauri://drag-drop` 등)로 변환 — 그 과정에서 **webview 내부의 HTML5 DnD 이벤트 전달이 차단됨** (특히 macOS WKWebView). webview 내부에서 dnd를 쓰는 SPA 입장에선 OS 가로채기가 치명적.

**해결:** `tauri.conf.json`의 windows entry에 명시적으로 `"dragDropEnabled": false` 추가. dev server 재시작 (Rust 재컴파일) 필요.

```json
"windows": [
  {
    "title": "munix",
    "width": 800,
    "height": 600,
    "dragDropEnabled": false
  }
]
```

**트레이드오프:** 외부(Finder/Explorer)에서 webview로 파일을 드래그-드롭하는 시나리오에 대한 Tauri 자체 이벤트는 못 받음. 단 webview의 HTML5 `ondrop` 핸들러에서 `e.dataTransfer.files`로 직접 받는 건 가능하므로 이미지 외부 드롭(Phase 4 체크리스트 16번)은 별도로 구현하면 됨.

**진단의 결정적 단서:** `dragstart` ✅ / `dragover` ❌ / `drop` ❌ / `dragend` ✅ 패턴. dragstart-dragend는 mousedown/mouseup 기반이라 OS 가로채기 영향이 적고, dragover/drop은 OS drag session을 거치므로 가로채기에 직접 영향 받음. 이 비대칭 패턴이 보이면 Tauri 설정부터 의심.

**부수 픽스 (같은 커밋에 포함):**
1. `file-list.tsx`의 row 구조를 단일 drag source로 정리. 기존엔 chevron · 파일명을 `<button draggable={false}>`로 감싸 row의 작은 영역만 drag 가능했음 → row `<div>` 하나에 모든 핸들러 통합, 내부는 `<span>` 시각 요소로 단순화. 클릭/더블클릭/contextMenu도 row level로 이동.
2. `handleRootDragOver` / `handleRootDrop`의 `dataTransfer.types` 체크 제거 — 이미 row dragover에는 적용됐던 WKWebView 호환성 패턴 (아래 "dragover types check" 항목 참조)이 root에는 누락돼 있었음.
3. dnd 라이프사이클 진단용 `console.debug` 로그 유지 (`dragstart`, `dragover row`, `dragover root`, `dragend`, `move` / skip 류). DnD는 회귀가 잦은 영역이라 디버깅 자산으로 남김.

**교훈:**
- Tauri 2 + webview 내부 HTML5 DnD를 쓴다면 `dragDropEnabled: false`가 사실상 필수 — 이걸 안 해두면 모든 in-app drag 기능이 silently 실패.
- DnD 디버깅의 첫 단계는 라이프사이클 이벤트 4종(`dragstart`/`dragover`/`drop`/`dragend`) 중 어디까지 발동하는지 확인. 이 4종 중 빠진 게 무엇인지가 root cause를 결정.

---

### 2026-04-25 — Tiptap suggestion plugin key 충돌

**카테고리:** Editor / Build
**관련 파일:** `wikilink/wikilink-suggestion.ts`, `slash-menu/suggestion.ts`
**관련 커밋:** `6711a91`

**증상:** DevTools 콘솔에 매 transaction마다 `TypeError: _a.getState is not a function. (In '_a.getState(prevState)', '_a.getState' is undefined)` 폭주. Wikilink + 슬래시 메뉴가 모두 활성화된 후 발생. 사용자 체감으로는 DnD가 "안 되는 것처럼" 보였음 (drop 후 store 업데이트가 React 사이클로 흘러가기 전 throw로 비정상 종료).

**원인:** `@tiptap/suggestion`을 두 번(슬래시 `/`, wikilink `[[`) 등록했는데 default pluginKey 충돌 가능. 회피하려고 wikilink에 `pluginKey: { key: "wikilinkSuggestion" } as unknown as ...` 식으로 plain object를 넣었는데 이건 PluginKey 인스턴스가 아니라 `getState` 메서드가 없음.

**해결:** 두 suggestion 모두 명시적 `new PluginKey("...")` 인스턴스 부여.

```ts
const slashPluginKey = new PluginKey("slashSuggestion");
const wikilinkPluginKey = new PluginKey("wikilinkSuggestion");
// 각각 SuggestionOptions.pluginKey 에 전달
```

**교훈:** Tiptap에서 동일 plugin (특히 Suggestion)을 여러 인스턴스로 등록하려면 PluginKey를 명시적으로 분리. 타입 캐스팅으로 우회하는 패턴은 절대 금지.

---

### 2026-04-25 — 파일 트리 DnD: 파일 행 drop 버블링으로 vault 루트로 이동

**카테고리:** UX / DnD
**관련 파일:** `components/file-list.tsx`
**관련 커밋:** `8c6436a`, `42c20f0`

**증상:** 파일을 다른 폴더로 드래그해서 그 폴더 내 파일 위에 떨어뜨리면 vault 루트로 이동. 폴더 위에 정확히 떨어뜨릴 때만 동작.

**원인:** 파일 행 `handleDrop`이 `if (!isDir) return;`로 일찍 리턴 + `preventDefault` 안 부르고 끝나서 이벤트가 root 컨테이너로 버블링. root drop 핸들러가 `props.onMove(src, "")` 실행.

**해결:** 모든 행에서 `e.stopPropagation()` 호출. 파일 위 drop은 그 파일의 부모 폴더로 이동하는 것으로 의미 부여 (`targetFolderForDrop`).

---

### 2026-04-25 — 파일 트리 dragover types check 가 일부 WebView에서 false

**카테고리:** UX / DnD / WebView 호환성
**관련 파일:** `components/file-list.tsx`
**관련 커밋:** `42c20f0`

**증상:** `e.dataTransfer.types.includes(DND_MIME)` 체크 후 `preventDefault`였는데 일부 환경에서 dragover 시 types가 비어있어 preventDefault 미발동 → drop 이벤트 자체 미발생.

**원인:** 보안 정책상 dragover 동안 types가 노출되지 않는 WebView 구현이 존재 (Safari/WKWebView 일부 버전). getData는 drop 시점에만 가능하지만 types도 비공개되는 경우 있음.

**해결:**
1. dragover에서 types 체크 제거, 항상 preventDefault
2. dragstart에서 `text/plain` 폴백 추가
3. drop에서 `getData(DND_MIME) || getData("text/plain")` 으로 source 복구

**교훈:** HTML5 DnD 호환성은 브라우저마다 미묘. dragover 단계에서는 가능한 관대하게, drop 단계에서 검증.

---

### 2026-04-25 — Rust rename이 모든 파일에 .md 확장자 강제

**카테고리:** Build / IPC
**관련 파일:** `src-tauri/src/vault.rs`
**관련 커밋:** `8c6436a`

**증상:** `.png`, `.json` 등 비-md 파일이 트리에 보이지만 DnD/rename 시 IPC가 `InvalidName` 에러 반환.

**원인:** `validate_md_extension`이 모든 rename에서 `new_rel`이 `.md`로 끝나는지 강제. 비-md 파일은 트리에 표시되도록 walk 필터를 풀었지만 rename 검증은 그대로였음.

**해결:** rename 시 확장자 정책 조정:
- 비-md 파일 → 어떤 확장자로든 허용
- `.md` 파일 → 비-md 확장자로 변경 시도만 차단 (노트 의미 보존)
- 폴더 → 검증 없음

---

### 2026-04-25 — macOS에서 `trash::delete`가 AppleScript 권한 오류(-1743)로 실패

**카테고리:** Build / macOS / Permissions
**관련 파일:** `munix/src-tauri/src/vault.rs`

**증상:** 컨텍스트 메뉴 → 삭제 시 `Error during a 'trash' operation: execution error: Finder에 Apple 이벤트를 보낼 권한이 없습니다. (-1743)` 에러.

**원인:** `trash` crate v5의 기본 `DeleteMethod::Finder`가 `osascript`로 Finder에 AppleScript 이벤트를 보냄 → 서명되지 않은 dev 빌드는 Automation 권한이 없어 실패.

**해결:** macOS 전용 분기로 `TrashContext`를 만들어 `DeleteMethod::NsFileManager`로 전환. NSFileManager의 `trashItemAtURL`을 직접 호출해 권한 필요 없이 휴지통 이동.

```rust
#[cfg(target_os = "macos")]
fn trash_delete(path: &Path) -> VaultResult<()> {
    use trash::macos::{DeleteMethod, TrashContextExtMacos};
    let mut ctx = trash::TrashContext::default();
    ctx.set_delete_method(DeleteMethod::NsFileManager);
    ctx.delete(path).map_err(|e| VaultError::Io(e.to_string()))
}
```

**트레이드오프:** NSFileManager 방식은 휴지통 "되돌리기" 메뉴가 일부 케이스에서 제한됨 (드래그 복원은 가능). Phase 6 배포 시 서명된 빌드에 Automation 권한 entitlement 추가 후 Finder 방식으로 복귀할지 재검토.

---

### 2026-04-25 — vault 검색 결과 클릭 시 스크롤이 리셋되는 현상

**카테고리:** UX / Editor
**관련 파일:** `munix/src/components/editor/editor-view.tsx`

**증상:** vault 전체 검색(Mod+Shift+F)에서 결과를 클릭하면 파일이 열리고 매치 위치로 스크롤되지만, 곧바로 상단 또는 하단으로 튀면서 스크롤이 초기화됨.

**원인:** `useEditor`의 `autofocus: "end"` 옵션이 에디터 생성 시 "끝으로 이동"을 트리거. 우리 코드가 `setSearchQuery`로 첫 매치에 스크롤하지만, autofocus의 layout-effect가 뒤늦게 덮어씀. 두 작업이 같은 프레임에서 경쟁.

**해결:**
1. `pendingSearchQuery`가 있으면 `autofocus: false`로 비활성화
2. `requestAnimationFrame`으로 search query 적용을 다음 프레임까지 지연

```ts
autofocus: hasPendingSearch ? false : "end",
// ...
requestAnimationFrame(() => {
  editor.commands.setSearchQuery(pending);
});
```

---

### 2026-04-25 — 검색 바가 스크롤에 딸려 내려감

**카테고리:** UX / Layout
**관련 파일:** `munix/src/components/editor/editor-view.tsx`

**증상:** Mod+F 검색 바가 우상단에 고정되어야 하는데, 에디터를 스크롤하면 같이 위로 사라짐.

**원인:** `position: absolute`가 스크롤 컨테이너(`overflow-y-auto`)의 자식일 경우, 스크롤되는 콘텐츠의 일부로 취급돼서 같이 움직임.

**해결:** 스크롤 컨테이너를 한 겹 더 안쪽으로 감싸 검색 바를 밖에 배치.

```tsx
<div className="relative h-full">
  <SearchBar />  {/* absolute, 스크롤 영향 없음 */}
  <div className="h-full overflow-y-auto">
    <EditorContent />
  </div>
</div>
```

---

### 2026-04-25 — Tiptap Table: 셀에서 Backspace가 안 먹히는 케이스

**카테고리:** UX / Editor
**관련 파일:** `munix/src/components/editor/table-delete-fix.ts`

**증상:** 에디터 내 표 복사 → 붙여넣기 → 드래그 셀 선택 → Backspace로 "일부만" 삭제 후 같은 작업을 반복하면 두 번째 Backspace가 안 먹힘. 표를 통째로 지우고 싶어도 빠져나갈 방법 없음.

**원인:** ProseMirror 스키마가 테이블 셀 경계를 보호 → Backspace가 셀 바깥으로 나가지 못함. `NodeSelection`으로 잡을 수 있는 UI 힌트도 기본값으로는 거의 없음.

**해결 (복합):**
1. `Table.configure({ allowTableNodeSelection: true })` — 표 전체 노드 선택 허용
2. 커스텀 키 extension `TableDeleteFix`:
   - `Esc`: 커서가 표 안이면 표 노드 선택 (다음 Backspace로 삭제)
   - `Mod+Shift+Backspace`: 커서가 표 안이면 즉시 `deleteTable()`
3. CSS: `.ProseMirror-selectednode` 아웃라인 + `.selectedCell` 반투명 배경 → 선택 상태 가시화

---

### 2026-04-25 — tiptap-markdown 테이블 round-trip 붕괴

**카테고리:** Build / Markdown
**관련 파일:** `munix/src/components/editor/extensions.ts`

**증상:** `specs/keymap-spec.md` 같은 GFM 테이블이 포함된 `.md`를 에디터로 열었다가 저장하면, 테이블이 **한 줄로 뭉개져** 저장됨.

**원인:** `@tiptap/extension-table` (과 부속)를 등록하지 않아 Tiptap이 테이블을 인식 못 함 → 텍스트로 수집 → 다시 직렬화할 때 구분선 없음.

**해결:** `@tiptap/extension-table/-row/-cell/-header` 설치 + `extensions.ts`에 등록. tiptap-markdown이 자동으로 테이블 노드를 GFM 테이블로 직렬화함.

**남은 제약:** GFM 문법에 컬럼 너비가 없음 → 리사이즈해도 저장 안 됨. Obsidian도 동일. 사이드카 메타파일은 Phase 4 후 재검토.

---

### 2026-04-25 — `@tiptap/extension-table` default export 없음

**카테고리:** Build / TS
**증상:** `import Table from "@tiptap/extension-table"` → TS2613 "no default export".

**원인:** v3에서 named export로 변경됨.

**해결:** `import { Table } from "@tiptap/extension-table"` — 동반 패키지(row/cell/header)도 동일.

---

### 2026-04-25 — `@tiptap/core` 타입 not found

**카테고리:** Build / TS
**증상:** 슬래시 메뉴 파일에서 `import type { Editor, Range } from "@tiptap/core"` → TS 모듈 못 찾음.

**원인:** 다른 tiptap 패키지의 transitive 의존성이라 node_modules에 실제 설치는 돼 있지만 package.json에는 없어 TS module resolution 실패.

**해결:** `pnpm add @tiptap/core` 직접 의존성 등록.

**교훈:** transitive 의존성에 타입을 기대하지 말고 직접 사용하는 건 명시적으로 install.

---

### 2026-04-25 — Rust `expected_modified` 충돌 감지가 안 도는 것처럼 보이는 현상

**카테고리:** Build / Dev Experience

**증상:** 충돌 다이얼로그 구현 직후 재현 테스트해보니 외부 수정 후 타이핑해도 다이얼로그가 안 뜸.

**원인:** `pnpm tauri dev`가 Rust 코드 변경을 자동 재컴파일 하지만, 특정 상황(예: 다이얼로그 핸들러 조합)에서는 반영 지연이 있음. 프론트 hot reload는 즉시 되는데 Rust는 안 됐을 가능성이 큼.

**해결:** dev 서버 재시작. 추가로 DevTools Console에서 `invoke('write_file', { expectedModified: 0, ... })`로 Rust 응답을 직접 확인하는 진단 루틴을 문서화.

---

### 2026-04-25 — 외부 편집 감지가 Obsidian/VSCode보다 느리게 느껴짐

**카테고리:** UX / Scope

**관찰:** VSCode·Obsidian은 외부에서 파일이 바뀌면 즉시(저장하지 않아도) 감지해서 알림. 우리 앱은 "저장 시 mtime 비교"만 해서 사용자가 편집을 가해야 충돌이 드러남.

**결정:** Phase 1 MVP는 save-time 비교로 간다. Obsidian 방식(notify → event emit → 에디터 clean/dirty 분기)은 Phase 3 Watcher에서 구현. 현재 save-time 비교도 defense-in-depth로 유지.

---

### 2026-04-25 — specs 폴더를 vault로 열어 테스트하다 문서 파괴

**카테고리:** UX / Safety

**증상:** `specs/`를 vault로 열어 에디터 동작을 테스트하다가 `keymap-spec.md`·`README.md` 등이 자동 저장되며 테이블·링크 포맷이 정규화되거나 한 줄로 뭉개짐.

**원인:** vault는 `.md` 확장자만 보지 루트 폴더 특수성은 무지. 테스트 중 실제 문서가 "첫 파일 자동 열기 + 타이핑 → 자동 저장" 경로로 부지불식간에 편집됨.

**해결 (현재):** 테스트 후 `git restore`로 원복, 커밋 직전 git diff로 스펙 파일 변경 여부 확인.

**추가 대응 (추후):** 
- 에디터에서 "이 vault는 읽기 전용" 모드 (frontmatter 또는 설정)
- 또는 테스트용 vault를 git-ignore된 `scratch/`에 두기

---

### 2026-04-25 — React 파일명 컨벤션 초기 혼선

**카테고리:** Convention
**관련 커밋:** 초기 scaffold

**증상:** 초기에 PascalCase 파일명(`Editor.tsx`, `FileList.tsx`)으로 시작했다가 사용자 지시로 전부 kebab-case(`editor.tsx`, `file-list.tsx`)로 rename.

**결정:** 
- 파일/폴더 이름은 **kebab-case**
- export 이름은 원래 규칙(컴포넌트 PascalCase, 훅 `useXxx`, 함수 camelCase)

**기록:** CLAUDE.md에 컨벤션 박제 + 메모리(`feedback_file_naming.md`)에 영구 기록. 이후 모든 새 파일 자동 적용.

---

### 2026-04-25 — Rust tokio 1.52.1이 미발표 tokio-macros 2.7.0 요구

**카테고리:** Build / Rust

**증상:** `cargo check`가 tokio-macros 2.7.0 lookup 실패로 실패. 최신 tokio가 아직 미발표 매크로 버전을 요구.

**원인:** 일시적 크레이트 publish 타이밍 이슈.

**해결:** `Cargo.toml`에 `tokio = { version = "=1.47.0", features = ["full"] }` 핀. `Cargo.lock`은 삭제 후 재생성.

**교훈:** 새 프로젝트 초기 셋업에서 메이저 크레이트는 특정 마이너로 핀하는 게 안전. 나중에 올리는 건 쉬움.

---

### 2026-04-25 — `editor.storage.markdown` 타입 없음

**카테고리:** Build / TS

**증상:** `editor.storage.markdown.getMarkdown()` 호출 시 TS 오류. `Storage`에 `markdown` 속성 없음.

**원인:** `tiptap-markdown` 패키지가 Tiptap의 `Storage` 인터페이스를 module augmentation으로 확장하지 않음.

**해결:** 우회 캐스팅
```ts
const storage = editor.storage as unknown as {
  markdown: { getMarkdown: () => string };
};
```

**교훈:** 타입을 제공하지 않는 Tiptap 확장은 로컬 타입 선언으로 싸매기.

---

## 이슈 분류 범례

- **Build**: 컴파일·의존성·타입
- **UX**: 사용자가 체감하는 동작
- **Editor**: Tiptap/ProseMirror 동작
- **Markdown**: round-trip·serialization
- **Convention**: 코드 스타일·네이밍
- **Safety**: 데이터 파괴 위험
- **Scope**: 기능 범위 결정

---

**작성일:** 2026-04-25
**최근 업데이트:** 2026-04-26 — Frontmatter Properties + 제목=파일명 + `---` 트리거 구현 중 발견 5개 (ProseMirror tr 충돌 / Rules of Hooks / render-time setState / 제목 디바운스 / PropertiesPanel 항상 노출) 추가
