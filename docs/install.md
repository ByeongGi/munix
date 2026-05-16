# Munix 설치 안내

Munix는 현재 초기 오픈소스 빌드이며 macOS Apple notarization은 적용되어 있지 않다. macOS에서는 GitHub Release DMG를 직접 열면 Gatekeeper 경고가 발생할 수 있으므로, 개발자/파워유저에게는 설치 스크립트 방식을 권장한다.

## 권장: 앱 + CLI 설치

macOS 개발자/파워유저는 아래 명령으로 GitHub Release DMG와 CLI tarball을 다운로드하고 `~/Applications/munix.app`을 설치할 수 있다. CLI는 앱 번들 내부에 설치하고 `/usr/local/bin/munix`는 그 바이너리를 가리키는 symlink로 만든다.

```bash
curl -fsSL https://github.com/ByeongGi/munix/releases/latest/download/install-macos.sh | bash
```

이 명령은 최신 공개 GitHub Release를 자동으로 찾아 설치한다. Draft release 상태에서는 공개 다운로드 URL이 아직 안정적으로 제공되지 않을 수 있다.

스크립트는 다음을 수행한다.

- GitHub Release의 DMG 다운로드
- GitHub Release의 `munix-cli_{version}_{arch}.tar.gz` 다운로드
- DMG mount
- `munix.app`을 `~/Applications/munix.app`에 복사
- `munix` CLI를 `~/Applications/munix.app/Contents/MacOS/munix-cli`에 설치
- `/usr/local/bin/munix` symlink를 앱 번들 내부 CLI로 연결
- 설치된 앱의 macOS quarantine 속성 제거

이 방식은 Node.js, Rust, pnpm 같은 빌드 환경을 요구하지 않는다. macOS 기본 도구인 `curl`, `hdiutil`, `ditto`, `tar`, `xattr`만 사용한다.

필요 조건:

- macOS
- 인터넷 연결
- 공식 GitHub Release를 신뢰한다는 사용자 판단

설치 위치를 바꾸려면 환경 변수를 사용한다.

```bash
export MUNIX_APP_INSTALL_DIR=/Applications
curl -fsSL https://github.com/ByeongGi/munix/releases/latest/download/install-macos.sh | bash
```

CLI 설치 위치를 바꾸려면:

```bash
export MUNIX_CLI_INSTALL_DIR="$HOME/.local/bin"
curl -fsSL https://github.com/ByeongGi/munix/releases/latest/download/install-macos.sh | bash
```

이 변수는 symlink 위치만 바꾼다. 실제 CLI 바이너리는 앱 번들 안에 있으므로 앱을 삭제하면 같이 제거된다.

CLI 설치를 건너뛰려면:

```bash
export MUNIX_INSTALL_CLI=0
curl -fsSL https://github.com/ByeongGi/munix/releases/latest/download/install-macos.sh | bash
```

특정 버전을 설치하려면:

```bash
export MUNIX_VERSION=0.1.1
curl -fsSL https://github.com/ByeongGi/munix/releases/latest/download/install-macos.sh | bash
```

설치 후 CLI는 Obsidian식 문법을 사용한다.

```bash
munix help
munix vault=Work open path="daily/2026-05-16.md"
munix vault=Work create path="inbox/idea.md" content="first draft" open
munix vault=Work search query="tauri ipc"
```

macOS에서는 Munix 앱이 꺼져 있으면 CLI가 `MUNIX_APP_PATH`, `~/Applications/munix.app`, `/Applications/munix.app` 순서로 앱을 찾아 실행한 뒤 명령을 전달한다.

## 삭제

권장 삭제 방법은 설치 스크립트의 uninstall 모드다. 앱과 CLI symlink를 함께 제거한다.

```bash
curl -fsSL https://github.com/ByeongGi/munix/releases/latest/download/install-macos.sh | bash -s -- --uninstall
```

수동으로 지울 때는 아래 두 경로를 제거한다.

```bash
rm -rf ~/Applications/munix.app
sudo rm -f /usr/local/bin/munix
```

macOS에서 앱을 휴지통으로 버리는 동작에는 uninstall hook이 없으므로 `/usr/local/bin/munix` symlink까지 자동 제거되지는 않는다. 다만 symlink 대상인 실제 CLI 바이너리는 앱 번들 안에 있어 앱 삭제 시 함께 사라진다.

## 소스에서 직접 빌드

배포 파일 대신 직접 소스에서 빌드하려면 아래 절차를 사용한다.

```bash
git clone https://github.com/ByeongGi/munix.git
cd munix/munix
pnpm install
pnpm release:build
open src-tauri/target/release/bundle/macos/munix.app
```

## GitHub Release DMG 설치

GitHub Release에서 받은 DMG는 더 간단하지만, Apple notarization이 적용되어 있지 않아 macOS Gatekeeper가 차단할 수 있다.

1. 최신 Release의 `munix_{version}_aarch64.dmg`를 다운로드한다. 현재 공개 버전은 `munix_0.1.1_aarch64.dmg`다.
2. DMG를 열고 `munix.app`을 `/Applications`로 드래그한다.
3. Applications에서 Munix를 실행한다.

macOS에서 다음 메시지가 표시될 수 있다.

> “munix” is damaged and can’t be opened. You should move it to the Trash.

공식 GitHub Release에서 받은 파일이고 신뢰할 수 있는 경우에만 아래 명령을 한 번 실행한다.

```bash
xattr -dr com.apple.quarantine /Applications/munix.app
```

그 다음 Munix를 다시 실행한다.

이 명령은 현재 설치한 앱에서 macOS quarantine 속성만 제거한다. 새 버전을 다시 설치하면 다시 필요할 수 있다.

## 왜 이런 안내가 필요한가

macOS는 인터넷에서 다운로드한 앱에 `com.apple.quarantine` 속성을 붙이고 첫 실행 시 Gatekeeper 검사를 수행한다. Developer ID 서명과 Apple notarization이 없는 앱은 실제로 손상되지 않았더라도 “damaged” 또는 “Apple cannot check it for malicious software” 경고로 차단될 수 있다.

Munix는 현재 무료 배포를 위해 Tauri ad-hoc signing을 사용한다. 정식으로 경고 없는 macOS 배포를 하려면 Apple Developer Program, Developer ID 인증서, notarization이 필요하다.
