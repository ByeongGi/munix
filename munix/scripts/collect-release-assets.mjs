import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { platform } from 'node:os';
import packageJson from '../package.json' with { type: 'json' };

const tag = `v${packageJson.version}`;
const currentPlatform = {
  darwin: 'macos',
  win32: 'windows',
  linux: 'linux',
}[platform()] ?? platform();

const bundleDir = join('src-tauri', 'target', 'release', 'bundle');
const outputDir = join('..', 'release-dist', tag, currentPlatform);
const allowedExtensions = new Set([
  '.AppImage',
  '.appimage',
  '.deb',
  '.dmg',
  '.exe',
  '.gz',
  '.msi',
  '.rpm',
  '.sig',
  '.zip',
]);

function walk(dir) {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stats = statSync(path);
    return stats.isDirectory() ? walk(path) : [path];
  });
}

const assets = walk(bundleDir).filter((file) => allowedExtensions.has(extname(file)));

if (assets.length === 0) {
  console.error(`No release assets found in ${bundleDir}. Run pnpm release:build first.`);
  process.exit(1);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const asset of assets) {
  copyFileSync(asset, join(outputDir, basename(asset)));
}

console.log(`Copied ${assets.length} asset(s) to ${outputDir}`);
for (const asset of assets) {
  console.log(`- ${basename(asset)}`);
}
