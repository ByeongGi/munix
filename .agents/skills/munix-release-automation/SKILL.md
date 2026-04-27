---
name: munix-release-automation
description: Automate Munix release builds and deployment. Use when the user asks to build, version bump, tag, upload, publish, deploy, or validate a Munix desktop release, including install-macos.sh and GitHub Releases.
---

# Munix Release Automation

Use this skill to ship a Munix release from the local repository.

## Preconditions

- Work from the repository root: `/Users/byeonggi/SIDE_PROJECT/note-app`.
- Confirm the worktree state before changing versions:
  `git status --short --branch`.
- If there are uncommitted product changes, commit them before the release bump.
- Use patch releases unless the user explicitly asks for minor/major.
- macOS releases currently publish Apple Silicon DMG assets only.

## Release Workflow

1. Determine the next version from `munix/package.json` and existing tags.
2. Update the app version in all release metadata:
   - `munix/package.json`
   - `munix/src-tauri/tauri.conf.json`
   - `munix/src-tauri/Cargo.toml`
   - the `[[package]] name = "munix"` entry in `munix/src-tauri/Cargo.lock`
3. Run the local release pipeline:
   `pnpm release:local` from `munix/`.
4. Compute the DMG checksum:
   `shasum -a 256 release-dist/v{version}/macos/munix_{version}_aarch64.dmg`.
5. Add or update the matching checksum case in `scripts/install-macos.sh`.
6. Re-run asset collection from `munix/`:
   `pnpm release:collect`.
7. Validate the collected installer against the local DMG:
   ```bash
   tmp_install_dir="$(mktemp -d /tmp/munix-install-check.XXXXXX)"
   MUNIX_VERSION={version} \
   MUNIX_DMG_URL="file:///Users/byeonggi/SIDE_PROJECT/note-app/release-dist/v{version}/macos/munix_{version}_aarch64.dmg" \
   MUNIX_APP_INSTALL_DIR="$tmp_install_dir" \
   bash release-dist/v{version}/install-macos.sh
   test -d "$tmp_install_dir/munix.app"
   rm -rf "$tmp_install_dir"
   ```
8. Commit the release metadata:
   `chore(release): bump version to {version}`.
9. Tag and push:
   ```bash
   git tag v{version}
   git push origin main
   git push origin v{version}
   ```
10. Upload release assets from `munix/`:
    `pnpm release:upload -- --tag v{version}`.
11. Publish the release as latest:
    `gh release edit v{version} --draft=false --latest`.
12. Verify the public release:
    - `gh release view v{version} --json tagName,isDraft,url,assets`
    - `gh release list --limit 4`
13. Validate the public latest installer:
    ```bash
    tmp_install_dir="$(mktemp -d /tmp/munix-latest-install-check.XXXXXX)"
    curl -fsSL https://github.com/ByeongGi/munix/releases/latest/download/install-macos.sh \
      | MUNIX_APP_INSTALL_DIR="$tmp_install_dir" bash
    test -d "$tmp_install_dir/munix.app"
    rm -rf "$tmp_install_dir"
    ```

## Expected Warnings

- Vite may warn about mixed static/dynamic imports and large chunks.
- Tauri may skip notarization when Apple signing environment variables are absent.
- Treat these as known warnings unless the command exits non-zero.

## Final Response

Report the version, commit hash, tag, release URL, uploaded assets, checksum, and installer validation result. If git stage/commit/push succeeded, include the required app git directives in the final answer.
