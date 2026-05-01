import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const command = process.argv[2] ?? 'dev';
const forwardedArgs = process.argv.slice(3);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, '..');
const ghosttyDir = process.env.MUNIX_GHOSTTY_SOURCE_DIR
  ? resolve(process.env.MUNIX_GHOSTTY_SOURCE_DIR)
  : join(projectDir, 'src-tauri', '.native', 'ghostty');
const includeDir = join(ghosttyDir, 'zig-out', 'include');
const libDir = join(ghosttyDir, 'zig-out', 'lib');
const tauriBin = process.platform === 'win32'
  ? join(projectDir, 'node_modules', '.bin', 'tauri.cmd')
  : join(projectDir, 'node_modules', '.bin', 'tauri');

function run(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!['dev', 'build'].includes(command)) {
  console.error(`Unsupported native Tauri command: ${command}`);
  process.exit(1);
}

if (process.platform !== 'darwin') {
  run(tauriBin, [command, ...forwardedArgs], { cwd: projectDir });
  process.exit(0);
}

run('node', [join('scripts', 'ensure-libghostty.mjs')], { cwd: projectDir });

if (!existsSync(join(includeDir, 'ghostty.h')) || !existsSync(join(libDir, 'libghostty.a'))) {
  console.error('libghostty outputs are missing after prepare step.');
  process.exit(1);
}

run(
  tauriBin,
  [command, '--features', 'native-libghostty', ...forwardedArgs],
  {
    cwd: projectDir,
    env: {
      ...process.env,
      GHOSTTY_INCLUDE_DIR: includeDir,
      GHOSTTY_LIB_DIR: libDir,
    },
  },
);
