# Munix

> Obsidian 호환 `.md` 파일을 블록 기반 에디터로 편집하는 **로컬 퍼스트** 데스크톱 노트앱.

Munix는 로컬 폴더의 Markdown 파일을 그대로 다루는 데스크톱 노트 앱이다. 클라우드 동기화를 쓰기 어렵거나, 노트를 특정 서비스에 묶어두고 싶지 않을 때 Obsidian / Notion 대신 사용할 수 있도록 만들고 있다.

파일은 표준 GFM `.md`로 저장하고, 앱 전용 데이터는 vault 안의 `.munix/` 폴더에만 둔다. 에디터는 Tiptap 기반이며, 슬래시 메뉴, wikilink, callout, frontmatter 같은 Obsidian 친화 기능을 지원하는 방향으로 개발 중이다.

이름은 **Mu**(無, 덜어냄)와 **Onyx**(단단하고 차분한 검은 보석)에서 가져왔다.

## 주요 기능

- 블록 기반 에디터: 슬래시 `/` 메뉴, 헤딩, 표, 콜아웃, 토글, 코드 블록
- Obsidian 호환 Markdown: GFM, YAML frontmatter, `[[wikilink]]`, `==highlight==`, `> [!NOTE]`
- Wikilink / 백링크: `[[` 자동완성, 클릭 이동, 백링크 패널
- 태그 인덱스: inline `#tag`와 frontmatter `tags` 통합
- 자동 저장: 750ms debounce, blur 시 즉시 저장, 충돌 감지
- 로컬 검색: 인파일 검색과 vault 전체 검색
- QuickOpen / Command Palette: `Mod+P`, `Mod+K`
- 탭 멀티 문서: 최대 10개, 드래그 재배치, dirty dot
- 멀티 vault: 좌측 Vault Dock, vault 별 워크스페이스 / 설정 override
- 테마와 편집 환경 설정: 다크 / 라이트 / 시스템, 본문 크기, 에디터 너비

## 기술 스택

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

## 설치 / 실행

### 앱 설치

macOS에서는 CLI 설치를 사용할 수 있다. GitHub Release의 DMG를 받아 `~/Applications/munix.app`에 설치하고 quarantine 속성을 제거한다. Node.js, Rust, pnpm 같은 빌드 환경은 필요 없다.

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

### 개발 환경

- Node.js 20 LTS+
- Rust 1.77+ (Cargo)
- pnpm 9+

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

> 첫 빌드는 Rust 의존성 컴파일로 시간이 걸린다. 두 번째부터는 incremental.

## Vault 구조

vault는 Munix가 다루는 폴더 단위다. 폴더 자체가 데이터이고, 그 안의 `.md` 파일이 파일 트리에 표시된다.

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

`.munix/`만 앱 전용이다. 나머지 파일과 폴더는 사용자 데이터로 취급하며, 자동 변환이나 마이그레이션을 하지 않는다.

## 단축키

자주 쓰는 단축키만 적어둔다. 전체 목록은 [`docs/specs/keymap-spec.md`](./docs/specs/keymap-spec.md)에서 관리한다.

| 단축키 | 동작 |
|---|---|
| `Mod+P` | QuickOpen (파일 열기) |
| `Mod+K` | Command Palette |
| `Mod+F` | 인파일 검색 |
| `Mod+Shift+F` | Vault 전체 검색 |
| `Mod+,` | 설정 |
| `Mod+S` | 즉시 저장 |
| `Mod+T` | 새 탭 |
| `Mod+W` | 현재 탭 닫기 |
| `Mod+Shift+O` | Vault Switcher 팔레트 |

## 보안 / 프라이버시

- 모든 데이터는 로컬에 저장한다.
- 앱이 노트 내용을 외부 서버로 전송하지 않는다.
- 모든 FS 접근은 vault 모듈을 통과하며 path traversal (`..`) 차단.
- Tauri allowlist `fs` API 비활성화 — 자체 IPC 커맨드만 사용.
- 심볼릭 링크 기본 미따라감.

## 라이선스

MIT — [`LICENSE`](./LICENSE) 참조.

런타임 의존성은 모두 MIT/Apache-2.0/BSD 계열 (GPL/AGPL/LGPL 제외 정책).
의존성 라이선스 통지는 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

## 문서

- [`docs/munix-design-v0.3.md`](./docs/munix-design-v0.3.md): 전체 설계
- [`docs/decisions.md`](./docs/decisions.md): 주요 결정 기록
- [`docs/implementation-plan.md`](./docs/implementation-plan.md): 구현 단계
- [`docs/issues-log.md`](./docs/issues-log.md): 개발 중 발견한 이슈
- [`docs/release.md`](./docs/release.md): 릴리즈 절차

## 감사

- [Tauri](https://tauri.app) — Rust 기반 데스크톱 앱 프레임워크
- [Tiptap](https://tiptap.dev) — Headless 리치 텍스트 에디터
- [Obsidian](https://obsidian.md) — `.md` 호환성 / wikilink / callout 표준의 영감
