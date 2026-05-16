# Munix

> Obsidian 호환 `.md` 파일을 블록 기반 에디터로 편집하는 **로컬 퍼스트** 데스크톱 노트앱.

Munix는 로컬 폴더의 Markdown 파일을 그대로 다루는 데스크톱 노트 앱이다. 파일은 표준 GFM `.md`로 저장하고, 앱 전용 데이터는 vault 안의 `.munix/` 폴더에만 둔다.

## 주요 기능

- 블록 기반 Markdown 에디터
- Obsidian 호환: frontmatter, wikilink, highlight, callout
- 자동 저장과 충돌 감지
- 로컬 검색, QuickOpen, Command Palette
- 탭 멀티 문서와 멀티 vault
- 다크 / 라이트 / 시스템 테마

## 기술 스택

| 레이어   | 선택                                |
| -------- | ----------------------------------- |
| 앱 셸    | Tauri 2.x (Rust + WebView)          |
| UI       | React 19 + TypeScript               |
| 에디터   | Tiptap 3.x + `tiptap-markdown`      |
| 컴포넌트 | shadcn/ui + Radix                   |
| 스타일   | Tailwind CSS v4 + tailwind-variants |
| 상태     | Zustand                             |
| 빌드     | Vite                                |
| 패키지   | pnpm 9                              |

## 설치 / 실행

### 앱 설치

```bash
curl -fsSL https://github.com/ByeongGi/munix/releases/latest/download/install-macos.sh | bash
open ~/Applications/munix.app
```

이 설치 스크립트는 앱과 함께 `munix` CLI도 `/usr/local/bin/munix`에 설치한다.

```bash
munix help
munix vault=Work open path="note.md"
munix vault=Work search query="tauri ipc"
```

자세한 설치 안내: [`docs/install.md`](./docs/install.md)

### 개발 환경

- Node.js 24+
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

릴리즈용 앱과 CLI 산출물을 함께 만들려면:

```bash
cd munix
pnpm release:build
```

## Vault 구조

vault는 Munix가 다루는 폴더 단위다.

```
my-vault/
├── note.md
├── attachments/
│   └── 20260425-x.png
├── projects/
│   └── munix/
│       └── plan.md
└── .munix/
    ├── backup/
    ├── cache/
    ├── workspace.json
    └── settings.json
```

`.munix/`만 앱 전용이다. 나머지 파일과 폴더는 사용자 데이터로 취급한다.

## 보안 / 프라이버시

- 모든 데이터는 로컬에 저장한다.
- 모든 FS 접근은 vault 모듈을 통과하며 path traversal (`..`) 차단.

## 라이선스

MIT — [`LICENSE`](./LICENSE) 참조.

## 문서

- [`docs/decisions.md`](./docs/decisions.md)
- [`docs/implementation-plan.md`](./docs/implementation-plan.md)
- [`docs/app-architecture-mermaid.md`](./docs/app-architecture-mermaid.md)
- [`docs/issues-log.md`](./docs/issues-log.md)
- [`docs/release.md`](./docs/release.md)
