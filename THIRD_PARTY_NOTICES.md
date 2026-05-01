# Third-Party Notices

Munix는 다음 오픈소스 의존성을 사용합니다. 각 패키지는 해당 라이선스에 따라 배포되며, 원저작자에게 모든 권리가 있습니다. Munix 자체는 [MIT 라이선스](./LICENSE)로 배포됩니다.

이 문서는 Munix v0.1.0 시점에 production runtime에 포함되는 의존성을 알파벳 순으로 정리한 것입니다. devDependencies(빌드 도구, 린터, 테스트 러너 등)는 최종 사용자에게 배포되지 않으므로 제외했습니다.

라이선스 본문은 각 패키지의 저장소(`node_modules/.pnpm/<name>/node_modules/<name>/LICENSE` 또는 `~/.cargo/registry/src/.../LICENSE`)에 포함되어 있습니다.

---

## JavaScript / TypeScript 의존성 (pnpm)

다음은 `package.json`의 `dependencies`와 그로부터 파생된 모든 transitive production 의존성입니다. 정보 출처: `pnpm-lock.yaml`의 snapshot 트리 + 각 패키지의 `package.json` `license` 필드.

| 패키지 | 버전 | 라이선스 |
|--------|------|----------|
| @babel/runtime | 7.29.2 | MIT |
| @floating-ui/core | 1.7.5 | MIT |
| @floating-ui/dom | 1.7.6 | MIT |
| @floating-ui/react-dom | 2.1.8 | MIT |
| @floating-ui/utils | 0.2.11 | MIT |
| @popperjs/core | 2.11.8 | MIT |
| @radix-ui/primitive | 1.1.3 | MIT |
| @radix-ui/react-arrow | 1.1.7 | MIT |
| @radix-ui/react-collection | 1.1.7 | MIT |
| @radix-ui/react-compose-refs | 1.1.2 | MIT |
| @radix-ui/react-context | 1.1.2 | MIT |
| @radix-ui/react-context-menu | 2.2.16 | MIT |
| @radix-ui/react-dialog | 1.1.15 | MIT |
| @radix-ui/react-direction | 1.1.1 | MIT |
| @radix-ui/react-dismissable-layer | 1.1.11 | MIT |
| @radix-ui/react-dropdown-menu | 2.1.16 | MIT |
| @radix-ui/react-focus-guards | 1.1.3 | MIT |
| @radix-ui/react-focus-scope | 1.1.7 | MIT |
| @radix-ui/react-id | 1.1.1 | MIT |
| @radix-ui/react-menu | 2.1.16 | MIT |
| @radix-ui/react-popover | 1.1.15 | MIT |
| @radix-ui/react-popper | 1.2.8 | MIT |
| @radix-ui/react-portal | 1.1.9 | MIT |
| @radix-ui/react-presence | 1.1.5 | MIT |
| @radix-ui/react-primitive | 2.1.3 | MIT |
| @radix-ui/react-roving-focus | 1.1.11 | MIT |
| @radix-ui/react-slot | 1.2.3 | MIT |
| @radix-ui/react-slot | 1.2.4 | MIT |
| @radix-ui/react-tooltip | 1.2.8 | MIT |
| @radix-ui/react-use-callback-ref | 1.1.1 | MIT |
| @radix-ui/react-use-controllable-state | 1.2.2 | MIT |
| @radix-ui/react-use-effect-event | 0.0.2 | MIT |
| @radix-ui/react-use-escape-keydown | 1.1.1 | MIT |
| @radix-ui/react-use-layout-effect | 1.1.1 | MIT |
| @radix-ui/react-use-rect | 1.1.1 | MIT |
| @radix-ui/react-use-size | 1.1.1 | MIT |
| @radix-ui/react-visually-hidden | 1.2.3 | MIT |
| @radix-ui/rect | 1.1.1 | MIT |
| @tauri-apps/api | 2.10.1 | Apache-2.0 OR MIT |
| @tauri-apps/plugin-dialog | 2.7.0 | MIT OR Apache-2.0 |
| @tauri-apps/plugin-opener | 2.5.3 | MIT OR Apache-2.0 |
| @tiptap/core | 3.22.4 | MIT |
| @tiptap/extension-blockquote | 3.22.4 | MIT |
| @tiptap/extension-bold | 3.22.4 | MIT |
| @tiptap/extension-bubble-menu | 3.22.4 | MIT |
| @tiptap/extension-bullet-list | 3.22.4 | MIT |
| @tiptap/extension-code | 3.22.4 | MIT |
| @tiptap/extension-code-block | 3.22.4 | MIT |
| @tiptap/extension-code-block-lowlight | 3.22.4 | MIT |
| @tiptap/extension-document | 3.22.4 | MIT |
| @tiptap/extension-dropcursor | 3.22.4 | MIT |
| @tiptap/extension-gapcursor | 3.22.4 | MIT |
| @tiptap/extension-hard-break | 3.22.4 | MIT |
| @tiptap/extension-heading | 3.22.4 | MIT |
| @tiptap/extension-highlight | 3.22.4 | MIT |
| @tiptap/extension-horizontal-rule | 3.22.4 | MIT |
| @tiptap/extension-image | 3.22.4 | MIT |
| @tiptap/extension-italic | 3.22.4 | MIT |
| @tiptap/extension-link | 3.22.4 | MIT |
| @tiptap/extension-list | 3.22.4 | MIT |
| @tiptap/extension-list-item | 3.22.4 | MIT |
| @tiptap/extension-list-keymap | 3.22.4 | MIT |
| @tiptap/extension-ordered-list | 3.22.4 | MIT |
| @tiptap/extension-paragraph | 3.22.4 | MIT |
| @tiptap/extension-placeholder | 3.22.4 | MIT |
| @tiptap/extension-strike | 3.22.4 | MIT |
| @tiptap/extension-table | 3.22.4 | MIT |
| @tiptap/extension-table-cell | 3.22.4 | MIT |
| @tiptap/extension-table-header | 3.22.4 | MIT |
| @tiptap/extension-table-row | 3.22.4 | MIT |
| @tiptap/extension-task-item | 3.22.4 | MIT |
| @tiptap/extension-task-list | 3.22.4 | MIT |
| @tiptap/extension-text | 3.22.4 | MIT |
| @tiptap/extension-underline | 3.22.4 | MIT |
| @tiptap/extensions | 3.22.4 | MIT |
| @tiptap/pm | 3.22.4 | MIT |
| @tiptap/react | 3.22.4 | MIT |
| @tiptap/starter-kit | 3.22.4 | MIT |
| @tiptap/suggestion | 3.22.4 | MIT |
| @types/hast | 3.0.4 | MIT |
| @types/linkify-it | 3.0.5 | MIT |
| @types/linkify-it | 5.0.0 | MIT |
| @types/markdown-it | 13.0.9 | MIT |
| @types/markdown-it | 14.1.2 | MIT |
| @types/mdurl | 1.0.5 | MIT |
| @types/mdurl | 2.0.0 | MIT |
| @types/unist | 3.0.3 | MIT |
| @types/use-sync-external-store | 0.0.6 | MIT |
| argparse | 1.0.10 | MIT |
| argparse | 2.0.1 | Python-2.0 |
| aria-hidden | 1.2.6 | MIT |
| clsx | 2.1.1 | MIT |
| cross-fetch | 4.1.0 | MIT |
| dequal | 2.0.3 | MIT |
| detect-node-es | 1.1.0 | MIT |
| devlop | 1.1.0 | MIT |
| entities | 4.5.0 | BSD-2-Clause |
| entities | 8.0.0 | BSD-2-Clause |
| esprima | 4.0.1 | BSD-2-Clause |
| extend-shallow | 2.0.1 | MIT |
| fast-equals | 5.4.0 | MIT |
| fuse.js | 7.3.0 | Apache-2.0 |
| get-nonce | 1.0.1 | MIT |
| gray-matter | 4.0.3 | MIT |
| highlight.js | 11.11.1 | BSD-3-Clause |
| html-parse-stringify | 3.0.1 | MIT |
| i18next | 26.0.8 | MIT |
| i18next-browser-languagedetector | 8.2.1 | MIT |
| i18next-http-backend | 3.0.6 | MIT |
| is-extendable | 0.1.1 | MIT |
| js-yaml | 3.14.2 | MIT |
| kind-of | 6.0.3 | MIT |
| linkify-it | 5.0.0 | MIT |
| linkifyjs | 4.3.2 | MIT |
| lowlight | 3.3.0 | MIT |
| lucide-react | 1.11.0 | ISC |
| markdown-it | 14.1.1 | MIT |
| markdown-it-task-lists | 2.1.1 | ISC |
| mdurl | 2.0.0 | MIT |
| minisearch | 7.2.0 | MIT |
| nanoid | 3.3.11 | MIT |
| nanoid | 5.1.9 | MIT |
| node-fetch | 2.7.0 | MIT |
| orderedmap | 2.1.1 | MIT |
| prosemirror-changeset | 2.4.1 | MIT |
| prosemirror-commands | 1.7.1 | MIT |
| prosemirror-dropcursor | 1.8.2 | MIT |
| prosemirror-gapcursor | 1.4.1 | MIT |
| prosemirror-history | 1.5.0 | MIT |
| prosemirror-keymap | 1.2.3 | MIT |
| prosemirror-markdown | 1.13.4 | MIT |
| prosemirror-model | 1.25.4 | MIT |
| prosemirror-schema-list | 1.5.1 | MIT |
| prosemirror-state | 1.4.4 | MIT |
| prosemirror-tables | 1.8.5 | MIT |
| prosemirror-transform | 1.12.0 | MIT |
| prosemirror-view | 1.41.8 | MIT |
| punycode.js | 2.3.1 | MIT |
| react | 19.2.5 | MIT |
| react-dom | 19.2.5 | MIT |
| react-i18next | 17.0.4 | MIT |
| react-remove-scroll | 2.7.2 | MIT |
| react-remove-scroll-bar | 2.3.8 | MIT |
| react-style-singleton | 2.2.3 | MIT |
| rope-sequence | 1.3.4 | MIT |
| scheduler | 0.27.0 | MIT |
| section-matter | 1.0.0 | MIT |
| sprintf-js | 1.0.3 | BSD-3-Clause |
| strip-bom-string | 1.0.0 | MIT |
| tailwind-merge | 3.5.0 | MIT |
| tailwind-variants | 3.2.2 | MIT |
| tailwindcss | 4.2.4 | MIT |
| tippy.js | 6.3.7 | MIT |
| tiptap-markdown | 0.9.0 | MIT |
| tr46 | 0.0.3 | MIT |
| tslib | 2.8.1 | 0BSD |
| uc.micro | 2.1.0 | MIT |
| use-callback-ref | 1.3.3 | MIT |
| use-debounce | 10.1.1 | MIT |
| use-sidecar | 1.1.3 | MIT |
| use-sync-external-store | 1.6.0 | MIT |
| w3c-keyname | 2.2.8 | MIT |
| webidl-conversions | 3.0.1 | BSD-2-Clause |
| whatwg-url | 5.0.0 | MIT |
| zustand | 5.0.12 | MIT |

### JS 라이선스 요약

- **MIT**: 대다수 (≈140개)
- **BSD-2-Clause**: entities, esprima
- **BSD-3-Clause**: highlight.js, sprintf-js
- **0BSD**: tslib
- **ISC**: lucide-react, markdown-it-task-lists
- **Apache-2.0**: fuse.js
- **MIT OR Apache-2.0** (dual): @tauri-apps/* 3종
- **Apache-2.0 OR MPL-2.0** (dual): DOMPurify (Apache-2.0 조건으로 사용 가능)
- **Python-2.0** (PSF License, BSD-호환 permissive): argparse@2.0.1
- **MIT**: khroma@2.1.0 (package.json license 필드는 비어 있으나 배포 패키지의 `license` 파일은 MIT)

GPL/LGPL/AGPL/EPL 등 강한 카피레프트 라이선스는 발견되지 않았습니다.

---

## Rust 의존성 (Cargo)

다음은 `src-tauri/Cargo.toml`의 `[dependencies]`(direct production)에 명시된 crate들입니다. transitive 의존성은 Cargo.lock에 약 630여 개가 포함되어 있으며, 모두 crates.io 표준 permissive 라이선스(MIT / Apache-2.0 / BSD / Unicode / Zlib 등) 계열입니다. 정확한 transitive 라이선스 목록은 `cargo install cargo-license && cargo license` 명령으로 추후 확인할 수 있습니다.

| Crate | 버전 | 라이선스 |
|-------|------|----------|
| chrono | 0.4 | MIT OR Apache-2.0 |
| gray_matter | 0.3.2 | MIT |
| image | 0.25.10 | MIT-CMU AND Apache-2.0 |
| notify | 7 | CC0-1.0 OR Artistic-2.0 |
| notify-debouncer-full | 0.4 | MIT OR Apache-2.0 |
| serde | 1 | MIT OR Apache-2.0 |
| serde_json | 1 | MIT OR Apache-2.0 |
| sha2 | 0.11.0 | MIT OR Apache-2.0 |
| tauri | 2 | MIT OR Apache-2.0 |
| tauri-plugin-dialog | 2.7.0 | MIT OR Apache-2.0 |
| tauri-plugin-fs | 2.5.0 | MIT OR Apache-2.0 |
| tauri-plugin-opener | 2 | MIT OR Apache-2.0 |
| tauri-plugin-shell | 2.3.5 | MIT OR Apache-2.0 |
| thiserror | 2.0.18 | MIT OR Apache-2.0 |
| tokio | 1.47.0 | MIT |
| trash | 5.2.5 | MIT |
| uuid | 1 | Apache-2.0 OR MIT |
| walkdir | 2.5.0 | MIT OR Unlicense |

### Build Dependencies

| Crate | 버전 | 라이선스 |
|-------|------|----------|
| tauri-build | 2 | MIT OR Apache-2.0 |

### Rust 라이선스 요약

- **MIT OR Apache-2.0** (dual): 대부분의 crates (Tauri 생태계 전체, serde, tokio, sha2, thiserror, chrono 등)
- **MIT**: gray_matter, trash, tokio
- **MIT-CMU AND Apache-2.0**: image
- **CC0-1.0 OR Artistic-2.0** (dual permissive): notify
- **MIT OR Unlicense** (dual): walkdir
- **MPL-2.0**: cssparser, cssparser-macros, dtoa-short, option-ext, selectors (Tauri/WebKit 계열 transitive 의존성)
- **MIT OR Apache-2.0 OR LGPL-2.1-or-later** (multi-license): r-efi (MIT/Apache-2.0 조건으로 사용 가능)

GPL/AGPL/EPL 등 강한 카피레프트 라이선스는 발견되지 않았습니다. MPL-2.0 계열 전이 의존성은 약한 파일 단위 카피레프트이므로, 해당 패키지를 수정하지 않고 라이선스 고지를 유지하는 조건으로 사용합니다.

---

## 번들 폰트 (Phase 6)

`munix/public/fonts/` 에 번들된 폰트. 모두 OFL-1.1 또는 MIT 호환 라이선스 (CLAUDE.md "라이선스" 정책 정합 — 카피레프트 폰트 없음).

| 파일 | 폰트 | 버전 | 저작권 | 라이선스 |
|---|---|---|---|---|
| `PretendardVariable.woff2` | Pretendard | v1.3.9 (2024-11-05) | © orioncactus and contributors | SIL OFL 1.1 |
| `JetBrainsMonoNerdFontMono-Regular.ttf` | JetBrains Mono Nerd Font Mono | NF v3.4.0 | © JetBrains s.r.o. (원본) + © Ryan L McIntyre & Nerd Fonts contributors (패처) | SIL OFL 1.1 (원본 폰트) + MIT (Nerd Fonts 패처) |
| `JetBrainsMonoNerdFontMono-Bold.ttf` | (위와 동일) | (위와 동일) | (위와 동일) | (위와 동일) |

라이선스 본문 (번들 위치):

- [`munix/public/fonts/OFL-Pretendard.txt`](./munix/public/fonts/OFL-Pretendard.txt) — Pretendard SIL OFL 1.1
- [`munix/public/fonts/OFL-JetBrainsMono.txt`](./munix/public/fonts/OFL-JetBrainsMono.txt) — JetBrains Mono 원본 SIL OFL 1.1
- [`munix/public/fonts/LICENSE-NerdFonts.txt`](./munix/public/fonts/LICENSE-NerdFonts.txt) — Nerd Fonts 패처 MIT

**OFL-1.1 핵심 조건** (앱 번들 시 준수 사항):

1. 위 라이선스 텍스트 본문 첨부 ✅ (위 `.txt` 파일들)
2. 폰트 자체 단독 판매 금지 ✅ (앱의 일부로 배포)
3. 수정 시 원본 이름 사용 금지 ✅ (수정 없이 그대로 번들)
4. 재배포 시 동일 라이선스 유지 ✅

---

## 추가 참고

- **Munix 자체**: MIT License — [LICENSE](./LICENSE)
- **개별 라이선스 본문**: 위 의존성들의 LICENSE 파일은 각 패키지 디렉토리(`munix/node_modules/.pnpm/<pkg>/node_modules/<pkg>/LICENSE`, `~/.cargo/registry/src/.../<crate>/LICENSE`)에 포함되어 있습니다.
- **자동 검증 명령**:
  - JavaScript: `cd munix && pnpm licenses list --prod`
  - Rust: `cd munix/src-tauri && cargo license`

이 문서는 의존성이 추가되거나 업데이트될 때 같이 갱신해야 합니다(`CLAUDE.md`의 라이선스 정책 참조).
