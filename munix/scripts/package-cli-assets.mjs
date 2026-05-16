import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { arch, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import packageJson from "../package.json" with { type: "json" };

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRootDir = resolve(scriptDir, "..");
const platformName =
  {
    darwin: "macos",
    linux: "linux",
    win32: "windows",
  }[platform()] ?? platform();

const releaseArch =
  {
    arm64: "aarch64",
    x64: "x64",
  }[arch()] ?? arch();

const binaryName = platform() === "win32" ? "munix-cli.exe" : "munix-cli";
const installedName = platform() === "win32" ? "munix.exe" : "munix";
const releaseDir = join(appRootDir, "src-tauri", "target", "release");
const source = join(releaseDir, binaryName);
const outputDir = join(releaseDir, "bundle", "cli");
const stagingDir = join(releaseDir, "cli-package");
const assetName = `munix-cli_${packageJson.version}_${releaseArch}.tar.gz`;
const output = join(outputDir, assetName);

if (!existsSync(source)) {
  console.error(`CLI binary not found: ${source}`);
  console.error("Run `cargo build --release --bin munix-cli` first.");
  process.exit(1);
}

if (platformName !== "macos") {
  console.log(
    `Packaging CLI asset for ${platformName}; installer integration currently targets macOS.`,
  );
}

rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });
mkdirSync(outputDir, { recursive: true });

const stagedBinary = join(stagingDir, installedName);
copyFileSync(source, stagedBinary);
chmodSync(stagedBinary, 0o755);

const result = spawnSync(
  "tar",
  ["-czf", output, "-C", stagingDir, installedName],
  {
    stdio: "inherit",
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Packaged ${output}`);
