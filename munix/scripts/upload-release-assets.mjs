import { existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import packageJson from "../package.json" with { type: "json" };

const args = process.argv.slice(2);
const tagFlagIndex = args.indexOf("--tag");
const tag =
  tagFlagIndex >= 0 ? args[tagFlagIndex + 1] : `v${packageJson.version}`;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRootDir = resolve(scriptDir, "..");
const repoRootDir = resolve(appRootDir, "..");
const releaseDir = join(repoRootDir, "release-dist", tag);

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function collectFiles(dir) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);
    return stats.isDirectory() ? collectFiles(path) : [path];
  });
}

const files = collectFiles(releaseDir);

if (files.length === 0) {
  console.error(
    `No assets found in ${releaseDir}. Run pnpm release:collect on each build machine first.`,
  );
  process.exit(1);
}

const releaseExists =
  spawnSync("gh", ["release", "view", tag], {
    stdio: "ignore",
    shell: process.platform === "win32",
  }).status === 0;

if (!releaseExists) {
  run("gh", [
    "release",
    "create",
    tag,
    "--draft",
    "--title",
    `Munix ${tag}`,
    "--notes",
    "Local Munix desktop release assets.",
  ]);
}

run("gh", ["release", "upload", tag, ...files, "--clobber"]);
