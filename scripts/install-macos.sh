#!/usr/bin/env bash
set -euo pipefail

VERSION="${MUNIX_VERSION:-latest}"
ARCH="${MUNIX_ARCH:-aarch64}"
APP_NAME="munix.app"
EXPECTED_SHA256="${MUNIX_SHA256:-}"
APP_INSTALL_DIR="${MUNIX_APP_INSTALL_DIR:-$HOME/Applications}"
APP_DEST="$APP_INSTALL_DIR/$APP_NAME"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/munix-install.XXXXXX")"
MOUNT_DIR="$WORK_DIR/mount"

cleanup() {
  if [ -d "$MOUNT_DIR" ]; then
    hdiutil detach "$MOUNT_DIR" -quiet || true
  fi
  rm -rf "$WORK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'Munix install failed: %s\n' "$*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "missing required command '$1'."
  fi
}

if [ "$(uname -s)" != "Darwin" ]; then
  fail "this installer currently supports macOS only."
fi

require_command curl
require_command hdiutil
require_command ditto
require_command shasum
require_command xattr

if [ "$VERSION" = "latest" ]; then
  LATEST_TAG="$(
    curl --fail --silent --location https://api.github.com/repos/ByeongGi/munix/releases/latest \
      | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' \
      | head -n 1
  )"
  if [ -z "$LATEST_TAG" ]; then
    fail "could not resolve the latest GitHub release tag."
  fi
  VERSION="${LATEST_TAG#v}"
fi

ASSET_NAME="munix_${VERSION}_${ARCH}.dmg"
DOWNLOAD_URL="${MUNIX_DMG_URL:-https://github.com/ByeongGi/munix/releases/download/v${VERSION}/${ASSET_NAME}}"
DMG_PATH="$WORK_DIR/$ASSET_NAME"

if [ -z "$EXPECTED_SHA256" ] && [ "$ARCH" = "aarch64" ]; then
  case "$VERSION" in
    0.1.4)
      EXPECTED_SHA256="e86defa2d4de84da8f70786778142f566967d1f50aa8d1c3165536d4aa313a05"
      ;;
    0.1.3)
      EXPECTED_SHA256="84775dd3b927be5ab063e9c580161a348c2c2fe6248662017f122566792138bd"
      ;;
    0.1.2)
      EXPECTED_SHA256="1aeceeb5c62d379cae574e2f81d02bf8e2e2ce6673711f5914859ec3c4fc7a05"
      ;;
    0.1.1)
      EXPECTED_SHA256="f9b8f5087c17a7a581f3e9f89f28392f3bc90e0a42adee403bd1900899a96314"
      ;;
    0.1.0)
      EXPECTED_SHA256="304824a2283920ffac8a40089205f9672b4f408e129cc53bcf1abf4aa056e1ae"
      ;;
  esac
fi

case "$(uname -m)" in
  arm64)
    if [ "$ARCH" != "aarch64" ]; then
      log "Warning: this Mac is Apple Silicon, but MUNIX_ARCH=$ARCH"
    fi
    ;;
  x86_64)
    fail "the current release asset is Apple Silicon only. Intel macOS builds are not published yet."
    ;;
esac

log "Downloading Munix $VERSION from:"
log "  $DOWNLOAD_URL"
curl --fail --location --progress-bar "$DOWNLOAD_URL" --output "$DMG_PATH"

if [ -n "$EXPECTED_SHA256" ]; then
  log "Verifying SHA256..."
  ACTUAL_SHA256="$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')"
  if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
    fail "SHA256 mismatch. Expected $EXPECTED_SHA256 but got $ACTUAL_SHA256."
  fi
else
  log "Warning: no SHA256 checksum configured for this version."
fi

mkdir -p "$MOUNT_DIR"
log "Mounting DMG..."
hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_DIR" -nobrowse -quiet

APP_SOURCE="$(find "$MOUNT_DIR" -maxdepth 2 -type d -name "$APP_NAME" -print -quit)"
if [ -z "$APP_SOURCE" ]; then
  fail "could not find $APP_NAME in the DMG."
fi

log "Installing Munix to:"
log "  $APP_DEST"
mkdir -p "$APP_INSTALL_DIR"
rm -rf "$APP_DEST"
ditto "$APP_SOURCE" "$APP_DEST"

log "Removing macOS quarantine attribute for this installed app..."
xattr -dr com.apple.quarantine "$APP_DEST" 2>/dev/null || true

log ""
log "Munix installed successfully."
log ""
log "Open it with:"
log "  open \"$APP_DEST\""
log ""
log "Note: Munix is currently ad-hoc signed and not Apple-notarized."
log "Only run this installer if you trust the official GitHub release."
