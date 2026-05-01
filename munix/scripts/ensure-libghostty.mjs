import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, '..');
const tauriDir = join(projectDir, 'src-tauri');
const nativeDir = join(tauriDir, '.native');
const ghosttyDir = process.env.MUNIX_GHOSTTY_SOURCE_DIR
  ? resolve(process.env.MUNIX_GHOSTTY_SOURCE_DIR)
  : join(nativeDir, 'ghostty');
const ghosttyRepo = process.env.MUNIX_GHOSTTY_REPO ?? 'https://github.com/ghostty-org/ghostty.git';
const ghosttyRef = process.env.MUNIX_GHOSTTY_REF ?? 'main';
const zig = process.env.MUNIX_ZIG ?? resolve('/opt/homebrew/opt/zig@0.15/bin/zig');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function output(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

function ensureMacOS() {
  if (process.platform !== 'darwin') {
    console.error('native libghostty build is currently macOS-only.');
    process.exit(1);
  }
}

function ensureTooling() {
  if (!existsSync(zig)) {
    console.error(`Zig 0.15.2 was not found at ${zig}. Install it with: brew install zig@0.15`);
    process.exit(1);
  }

  const version = output(zig, ['version']);
  if (version !== '0.15.2') {
    console.error(`Ghostty currently requires Zig 0.15.2, but ${zig} reports ${version ?? 'unknown'}.`);
    process.exit(1);
  }

  if (!output('xcrun', ['-find', 'metal']) || !output('xcrun', ['-find', 'metallib'])) {
    console.error('Xcode Metal Toolchain is missing. Run: xcodebuild -downloadComponent MetalToolchain');
    process.exit(1);
  }
}

function syncGhosttySource() {
  mkdirSync(nativeDir, { recursive: true });

  if (!existsSync(join(ghosttyDir, '.git'))) {
    run('git', ['clone', '--depth', '1', '--branch', ghosttyRef, ghosttyRepo, ghosttyDir]);
    return;
  }

  run('git', ['fetch', '--depth', '1', 'origin', ghosttyRef], { cwd: ghosttyDir });
  run('git', ['checkout', 'FETCH_HEAD'], { cwd: ghosttyDir });
}

function patchGhosttyBuild() {
  const buildFile = join(ghosttyDir, 'build.zig');
  const source = readFileSync(buildFile, 'utf8');
  if (source.includes('lib_static.install("libghostty.a");')) {
    return;
  }

  const oldBlock = `        // We shouldn't have this guard but we don't currently
        // build on macOS this way ironically so we need to fix that.
        if (!config.target.result.os.tag.isDarwin()) {
            lib_shared.installHeader(); // Only need one header
            if (config.target.result.os.tag == .windows) {
                lib_shared.install("ghostty-internal.dll");
                lib_static.install("ghostty-internal-static.lib");
            } else {
                lib_shared.install("ghostty-internal.so");
                lib_static.install("ghostty-internal.a");
            }
        }`;
  const newBlock = `        lib_shared.installHeader(); // Only need one header
        if (config.target.result.os.tag == .windows) {
            lib_shared.install("ghostty-internal.dll");
            lib_static.install("ghostty-internal-static.lib");
        } else if (config.target.result.os.tag.isDarwin()) {
            lib_static.install("libghostty.a");
        } else {
            lib_shared.install("ghostty-internal.so");
            lib_static.install("ghostty-internal.a");
        }`;

  if (!source.includes(oldBlock)) {
    console.error('Ghostty build.zig no longer matches the expected libghostty install patch.');
    console.error('Update scripts/ensure-libghostty.mjs for the new upstream build graph.');
    process.exit(1);
  }

  writeFileSync(buildFile, source.replace(oldBlock, newBlock));
}

function buildGhostty() {
  run(
    zig,
    [
      'build',
      '-Dapp-runtime=none',
      '-Dtarget=aarch64-macos.15.0',
      '-Doptimize=Debug',
      '-Demit-xcframework=false',
      '-Demit-macos-app=false',
      '-Demit-exe=false',
      '-Demit-terminfo=false',
      '-Demit-termcap=false',
      '-Demit-themes=false',
    ],
    { cwd: ghosttyDir },
  );
}

function verifyOutputs() {
  const includeDir = join(ghosttyDir, 'zig-out', 'include');
  const libDir = join(ghosttyDir, 'zig-out', 'lib');
  const header = join(includeDir, 'ghostty.h');
  const library = join(libDir, 'libghostty.a');

  if (!existsSync(header) || !existsSync(library)) {
    console.error('Ghostty build finished but required outputs were not found.');
    console.error(`Missing check: ${header}`);
    console.error(`Missing check: ${library}`);
    process.exit(1);
  }

  console.log(`GHOSTTY_INCLUDE_DIR=${includeDir}`);
  console.log(`GHOSTTY_LIB_DIR=${libDir}`);
}

ensureMacOS();
ensureTooling();
syncGhosttySource();
patchGhosttyBuild();
buildGhostty();
verifyOutputs();
