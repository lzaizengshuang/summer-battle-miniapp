#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS runtime shipped without CLI dependencies. */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const scriptRoot = fs.realpathSync(path.resolve(__dirname, '..', '..'));
const [action, target, ...extraArgs] = process.argv.slice(2);
const normalizedTarget = target === 'h5' ? 'web' : target;
const taroTypeByTarget = {
  web: 'h5',
  weapp: 'weapp',
  tt: 'tt',
};
const validTargets = new Set(['web', 'weapp', 'tt']);
const validActions = new Set(['build', 'preview']);

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    stdio: 'inherit',
  });
  child.once('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code || 0);
  });
  child.once('error', error => {
    console.error(error.message);
    process.exit(1);
  });
}

if (!validActions.has(action) || !validTargets.has(normalizedTarget)) {
  console.error('Usage: taro-build.cjs <build|preview> <web|weapp|tt|h5> [...args]');
  process.exit(1);
}

if (action === 'preview' && normalizedTarget === 'web') {
  console.error('Taro preview is only supported for weapp or tt.');
  process.exit(1);
}

if (process.env.COZE_TARO_LOCAL_ACTIVE !== scriptRoot) {
  run(process.execPath, [
    path.join(scriptRoot, '.cozeproj', 'scripts', 'local-workspace.cjs'),
    'taro-build',
    action,
    normalizedTarget,
    ...extraArgs,
  ], { cwd: scriptRoot });
  return;
}

const taroArgs = ['exec', 'taro', 'build', '--type', taroTypeByTarget[normalizedTarget]];
if (action === 'preview') {
  taroArgs.push('--preview');
}
taroArgs.push(...extraArgs);

run('pnpm', taroArgs, {
  cwd: process.env.COZE_WORKSPACE_PATH || scriptRoot,
});
