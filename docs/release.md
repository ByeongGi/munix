# Munix 릴리즈 절차

이 문서는 GitHub Releases에 macOS / Windows / Linux 설치 파일을 로컬에서 빌드해 업로드하는 절차를 정리한다.

## 로컬 사전 확인

```bash
cd munix
pnpm install
pnpm release:local
```

- `pnpm release:local`: lint/build 확인, Tauri 번들 생성, 릴리즈 산출물 수집을 순서대로 실행한다.
- `pnpm icon:generate`: 디자인 완료 후 `src-tauri/icons/source.png`를 기준으로 Tauri 아이콘 세트를 갱신한다.
- `pnpm release:check`: ESLint와 frontend production build를 확인한다.
- `pnpm release:build`: 현재 OS용 Tauri 번들을 생성한다.
- `pnpm release:collect`: 현재 OS의 번들 파일을 `release-dist/v{version}/{platform}/`으로 복사한다.

Tauri는 기본적으로 현재 OS용 설치 파일을 만든다. macOS / Windows / Linux 파일을 모두 배포하려면 각 OS 환경에서 같은 태그/버전으로 `pnpm release:local`을 한 번씩 실행한 뒤 `release-dist/` 내용을 한곳에 모아 업로드한다.

## 아이콘 갱신

아이콘 디자인이 확정되면 1024x1024 PNG를 `munix/src-tauri/icons/source.png`에 둔다.

```bash
cd munix
pnpm icon:generate
```

이 명령은 `src-tauri/icons/`의 desktop 아이콘 파일(`.icns`, `.ico`, PNG 세트)을 갱신한다. 모바일용 `ios/`, `android/` 생성물과 `source.png`는 로컬 생성물로 보고 Git 추적에서 제외한다.

## GitHub Releases 배포

1. `munix/package.json`, `munix/src-tauri/Cargo.toml`, `munix/src-tauri/tauri.conf.json`의 버전이 같은지 확인한다.
2. 로컬에서 릴리즈 파일을 빌드한다.
3. 변경사항을 커밋한다.
4. 버전 태그를 만들고 푸시한다.

```bash
git tag v0.1.0
git push origin v0.1.0
```

5. GitHub CLI로 draft release를 만들고 산출물을 업로드한다.

```bash
cd munix
pnpm release:upload
```

기본 태그는 `package.json`의 `version`에서 만든 `v0.1.0` 형식이다. 다른 태그를 쓰려면:

```bash
pnpm release:upload -- --tag v0.1.0
```

`release:upload`는 `gh release view`로 릴리즈 존재 여부를 확인한다. 없으면 draft release를 만들고, 있으면 기존 release에 파일을 `--clobber`로 다시 올린다.

## 배포 전 확인

- GitHub CLI 로그인: `gh auth login`
- Release draft의 파일명이 OS별로 모두 올라갔는지 확인한다.
- macOS: `.dmg` 또는 `.app.tar.gz`
- Windows: `.msi` 또는 `.exe`
- Linux: `.AppImage` 또는 `.deb`
- 새 환경에서 첫 실행, vault 열기, 파일 저장, 이미지 표시를 확인한다.

초기 릴리즈는 코드 서명 없이 배포한다. macOS Gatekeeper와 Windows SmartScreen 경고는 예상 동작이다.
