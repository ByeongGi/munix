import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, '..');
const command = process.argv[2];
const args = process.argv.slice(2);
const commandArgs = process.argv.slice(3);
const tauriBin = process.platform === 'win32'
  ? join(projectDir, 'node_modules', '.bin', 'tauri.cmd')
  : join(projectDir, 'node_modules', '.bin', 'tauri');

function run(commandName, commandArgs) {
  const result = spawnSync(commandName, commandArgs, {
    cwd: projectDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  process.exit(result.status ?? 1);
}

if (
  (command === 'dev' || command === 'build') &&
  !commandArgs.some((arg) => arg === '--help' || arg === '-h' || arg === '--version' || arg === '-V')
) {
  run('node', [join('scripts', 'tauri-native.mjs'), command, ...commandArgs]);
}

run(tauriBin, args);
