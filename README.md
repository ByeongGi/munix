# Munix

> Obsidian 호환 `.md` 파일을 블록 기반 에디터로 편집하는 **로컬 퍼스트** 데스크톱 노트앱.

클라우드 동기화가 보안상 어려운 환경(예: 사내망, 컴플라이언스 제약)에서 Obsidian / Notion 대체로 쓰도록 설계된 데스크톱 노트 앱이다. 파일은 표준 GFM `.md`로 저장되어 Obsidian과 100% 호환되고, 블록 기반 에디터(Notion 스타일 슬래시 메뉴, wikilink, callout 등)는 Tiptap으로 구현됐다.

이름은 **Mu**(無, 불필요한 것을 덜어냄)와 **Onyx**(단단하고 차분한 검은 보석)에서 출발했다. Munix는 복잡함을 덜어내고 로컬에 단단히 남는 Markdown 작업 공간을 지향한다.

## ✨ 주요 기능

- **블록 기반 에디터** — 슬래시 `/` 메뉴, 14+ 블록 종류 (헤딩, 표, 콜아웃 4종, 토글, 코드)
- **Obsidian 호환** — `.md` 네이티브 저장, 표준 GFM, frontmatter, `[[wikilink]]`, `==highlight==`, `> [!NOTE]` callout
- **Wikilink + 백링크** — `[[` 자동완성, 클릭으로 파일 열기, 백링크 패널
- **태그 인덱스** — inline `#tag` + frontmatter `tags` 통합, 사이드바에서 드릴다운
- **자동 저장** — 750ms debounce + blur 즉시 flush + 충돌 감지
- **로컬 검색** — 인파일 (`Mod+F`) + vault 전체 (`Mod+Shift+F`, fuse + MiniSearch)
- **QuickOpen / Command Palette** — `Mod+P`, `Mod+K`
- **탭 멀티 문서** — 최대 10개, 드래그 재배치, dirty dot
- **멀티 vault** — cmux 스타일 좌측 Vault Dock, `⌘⇧O` 팔레트, vault 별 워크스페이스 영구화, vault 별 설정 override
- **다크 / 라이트 / 시스템** 테마, 본문 크기 / 에디터 너비 설정

> 자세한 설계는 [`munix-design-v0.3.md`](./docs/munix-design-v0.3.md), 결정 기록은 [`decisions.md`](./docs/decisions.md), 알려진 이슈는 [`issues-log.md`](./docs/issues-log.md) 참조.

## 🛠 기술 스택

| 레이어 | 선택 |
|---|---|
| 앱 셸 | Tauri 2.x (Rust + WebView) |
| UI | React 19 + TypeScript |
| 에디터 | Tiptap 3.x + `tiptap-markdown` |
| 컴포넌트 | shadcn/ui + Radix |
| 스타일 | Tailwind CSS v4 + tailwind-variants |
| 상태 | Zustand |
| 빌드 | Vite |
| 패키지 | pnpm 9 |

## 🚀 빌드 / 실행

### 사전 요구

- Node.js 20 LTS+
- Rust 1.77+ (Cargo)
- pnpm 9+

### 설치

개발자/파워유저는 CLI 설치 방식을 권장한다. 이 방식은 GitHub Release DMG를 다운로드해 `~/Applications/munix.app`에 설치하고 quarantine 속성을 제거한다. Node.js, Rust, pnpm 같은 빌드 환경은 필요 없다.

```bash
curl -fsSL https://raw.githubusercontent.com/ByeongGi/munix/main/scripts/install-macos.sh | bash
```

설치 후:

```bash
open ~/Applications/munix.app
```

GitHub Release DMG도 제공하지만 현재 macOS notarization은 적용되어 있지 않다. 직접 설치 시 “damaged” 경고가 표시되면 공식 Release에서 받은 파일인지 확인한 뒤 아래 명령을 한 번 실행한다.

```bash
xattr -dr com.apple.quarantine /Applications/munix.app
```

자세한 설치 안내는 [`docs/install.md`](./docs/install.md)를 참조.

### 개발

```bash
cd munix
pnpm install
pnpm tauri dev
```

### 프로덕션 빌드

```bash
cd munix
pnpm tauri build
```

플랫폼별 산출물:
- macOS: `.dmg`, `.app`
- Windows: `.msi`
- Linux: `.AppImage`, `.deb`

> 첫 빌드는 Rust 의존성 컴파일로 시간이 걸린다. 두 번째부터는 incremental.

### 릴리즈

GitHub Releases 배포는 로컬에서 빌드한 파일을 업로드하는 방식으로 진행한다. 각 OS에서 `pnpm release:local`을 실행하면 산출물이 루트 `release-dist/`에 모인다.

```bash
cd munix
pnpm release:local
pnpm release:upload
```

자세한 절차는 [`docs/release.md`](./docs/release.md)를 참조.

## 📁 vault 구조

vault란 Munix가 다루는 폴더 단위. 폴더 자체가 곧 데이터 — 그 안의 모든 `.md` 파일이 트리에 표시된다.

```
my-vault/
├── note.md              # 표준 GFM markdown
├── attachments/
│   └── 20260425-x.png   # 이미지는 assets/ 또는 attachments/ 등
├── projects/
│   └── munix/
│       └── plan.md
└── .munix/              # 앱 전용 메타 (Obsidian의 .obsidian/ 와 유사)
    ├── backup/          # 매 저장 시 직전 버전 백업
    ├── cache/           # 썸네일 등
    ├── workspace.json   # 탭 / 사이드바 / 펼침 상태 (vault 별)
    └── settings.json    # 글로벌 settings 의 vault override (선택)
```

여러 vault 를 동시에 열 수 있다 (Vault Dock). 글로벌 vault 목록은 OS 설정 디렉토리의 `munix.json` 에 저장된다 (macOS: `~/Library/Application Support/app.munix.desktop/munix.json`).

`.munix/` 만 앱 전용. 나머지 파일/폴더는 모두 사용자 데이터로 취급되며 자동 변환·마이그레이션 없음.

## ⌨️ 단축키

상세는 [`specs/keymap-spec.md`](./docs/specs/keymap-spec.md). 자주 쓰는 것:

| 단축키 | 동작 |
|---|---|
| `Mod+P` | QuickOpen (파일 열기) |
| `Mod+K` | Command Palette |
| `Mod+F` | 인파일 검색 |
| `Mod+Shift+F` | Vault 전체 검색 |
| `Mod+/` | 단축키 치트시트 |
| `Mod+,` | 설정 |
| `Mod+S` | 즉시 저장 |
| `Mod+T` | 새 탭 |
| `Mod+W` | 현재 탭 닫기 |
| `Mod+1` ~ `Mod+9` | 탭 직접 이동 |
| `Mod+Shift+N` | 새 vault 열기 |
| `Mod+Shift+O` | Vault Switcher 팔레트 |
| `Mod+Alt+B` | Vault Dock 토글 |
| `Mod+Alt+1`~`9` | n번째 vault 로 |

## 🔒 보안 / 프라이버시

- **모든 데이터는 로컬에 저장**. 외부 서버로 전송되는 어떠한 트래픽도 없음.
- 모든 FS 접근은 vault 모듈을 통과하며 path traversal (`..`) 차단.
- Tauri allowlist `fs` API 비활성화 — 자체 IPC 커맨드만 사용.
- 심볼릭 링크 기본 미따라감.

## 📦 라이선스

MIT — [`LICENSE`](./LICENSE) 참조.

런타임 의존성은 모두 MIT/Apache-2.0/BSD 계열 (GPL/AGPL/LGPL 제외 정책).
의존성 라이선스 통지는 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

## 🙏 감사

- [Tauri](https://tauri.app) — Rust 기반 데스크톱 앱 프레임워크
- [Tiptap](https://tiptap.dev) — Headless 리치 텍스트 에디터
- [Obsidian](https://obsidian.md) — `.md` 호환성 / wikilink / callout 표준의 영감
