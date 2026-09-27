#!/usr/bin/env node
// Taro source is owned by Drive. Only these wrappers may write to the local workspace.
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS runtime shipped without CLI dependencies. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const scriptRoot = fs.realpathSync(path.resolve(__dirname, '..', '..'));
const source = fs.realpathSync(
  process.env.COZE_TARO_LOCAL_ACTIVE === scriptRoot && process.env.COZE_TARO_SOURCE_PATH
    ? process.env.COZE_TARO_SOURCE_PATH : scriptRoot,
);
const drivePath = path.resolve(process.env.COZE_DRIVE_ROOT || '/Coze/Drive');
const drive = fs.existsSync(drivePath) ? fs.realpathSync(drivePath) : drivePath;
const inside = (root, candidate) => candidate === root || candidate.startsWith(`${root}${path.sep}`);
const onDrive = inside(drive, source);
const digest = value => createHash('sha256').update(value).digest('hex');
// Separate from /tmp/nm: older dependency helpers clean unknown entries there.
const cacheRoot = path.join(os.tmpdir(), `coze-taro-${process.getuid()}`);
const projectCache = path.join(cacheRoot, digest(source));
const exclusions = [
  'node_modules', '.git', '/logs', '.pnpm-store', '.next', '.nuxt', '.output',
  '/dist', '/dist-web', '/dist-tt', '/server/dist', '/dist-server', '.cache', '.turbo', '*.tsbuildinfo',
  '.eslintcache', '.stylelintcache', '/next-env.d.ts',
];
const outputDirs = ['dist', 'dist-web', 'dist-tt', 'server/dist'];
const taroOutputDirs = {
  web: 'dist-web',
  h5: 'dist-web',
  weapp: 'dist',
  tt: 'dist-tt',
};
const installArgs = ['install', '--prefer-frozen-lockfile', '--prefer-offline'];
let interrupted = false;
const children = new Set();

function stopTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  // Keep descendants in the detached launcher's group so readiness ownership works.
  // Also stop grandchildren when the test/foreground path is signalled directly.
  let rows = [];
  try {
    rows = execFileSync('ps', ['-axo', 'pid=,ppid='], { encoding: 'utf8' })
      .trim().split('\n').map(line => line.trim().split(/\s+/).map(Number));
  } catch { /* The launcher still owns and reaps its process group. */ }
  const pids = [child.pid];
  for (let i = 0; i < pids.length; i++) {
    for (const [pid, parent] of rows) if (parent === pids[i]) pids.push(pid);
  }
  for (const pid of pids.reverse()) {
    try { process.kill(pid, 'SIGTERM'); } catch { /* Already exited. */ }
  }
  const timer = setTimeout(() => {
    for (const pid of pids) {
      try { process.kill(pid, 'SIGKILL'); } catch { /* Already exited. */ }
    }
  }, 2000);
  timer.unref();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    interrupted = true;
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
    for (const child of children) stopTree(child);
  });
}

function run(command, args, cwd, env = process.env) {
  if (interrupted) return Promise.reject(new Error('Interrupted'));
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
    children.add(child);
    child.once('error', error => { children.delete(child); reject(error); });
    child.once('exit', (code, signal) => {
      children.delete(child);
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${signal || code}`));
    });
  });
}

function ensureCache() {
  for (const dir of [cacheRoot, projectCache]) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (fs.lstatSync(dir).isSymbolicLink() || fs.statSync(dir).uid !== process.getuid()) {
      throw new Error(`Refusing unmanaged workspace directory: ${dir}`);
    }
    if (inside(drive, fs.realpathSync(dir))) {
      throw new Error(`Local workspace must be outside Coze Drive: ${dir}`);
    }
  }
}

async function locked(action, name = 'sync') {
  const lock = path.join(projectCache, `${name}.lock`);
  const started = Date.now();
  let missingOwner = 0;
  while (true) {
    if (interrupted) throw new Error('Interrupted');
    try { fs.mkdirSync(lock); break; } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    let alive = false;
    try {
      const pid = Number(fs.readFileSync(path.join(lock, 'pid'), 'utf8'));
      if (Number.isInteger(pid) && pid > 0) { process.kill(pid, 0); alive = true; }
    } catch (error) { if (error.code === 'EPERM') alive = true; }
    missingOwner = alive ? 0 : missingOwner + 1;
    if (missingOwner >= 2) {
      const stale = `${lock}.stale-${process.pid}`;
      try {
        fs.renameSync(lock, stale);
        fs.rmSync(stale, { recursive: true });
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      missingOwner = 0;
      continue;
    }
    if (Date.now() - started > 120000) throw new Error(`Timed out waiting for ${lock}`);
    await delay(500);
  }
  fs.writeFileSync(path.join(lock, 'pid'), String(process.pid));
  try { return await action(); }
  finally { fs.rmSync(lock, { recursive: true, force: true }); }
}

async function sync(local) {
  if (!fs.existsSync(path.join(source, 'package.json'))) {
    throw new Error(`Source project is unavailable: ${source}`);
  }
  fs.mkdirSync(local, { recursive: true });
  if (fs.realpathSync(local) !== local) throw new Error(`Refusing workspace symlink: ${local}`);
  // Checksums catch same-size edits with unchanged/epoch Drive mtimes. Do not use -t:
  // changed local files get fresh mtimes and unchanged files retain watcher snapshots.
  // Materialize source links so the framework never follows them back onto Drive.
  await run('rsync', [
    '-rLp', '--checksum', '--delete', '--delay-updates',
    ...exclusions.map(entry => `--exclude=${entry}`), `${source}/`, `${local}/`,
  ], source);
}

function readOptional(file) {
  try { return fs.readFileSync(file); }
  catch (error) { if (error.code === 'ENOENT') return Buffer.alloc(0); throw error; }
}

function installInput(root) {
  const hash = createHash('sha256');
  const visit = (dir, all = false) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (['node_modules', '.git', 'logs', '.pnpm-store', '.next', '.nuxt', '.output', 'dist', 'dist-web', 'dist-tt', 'dist-server', '.cache', '.turbo'].includes(entry.name)) continue;
      const file = path.join(dir, entry.name);
      // Follow source links just as rsync -L does, while detecting loops explicitly.
      const real = fs.realpathSync(file);
      if (entry.isDirectory() || (entry.isSymbolicLink() && fs.statSync(file).isDirectory())) {
        if (ancestors.has(real)) throw new Error(`Source symlink cycle: ${file}`);
        ancestors.add(real);
        visit(file, all || entry.name === 'patches');
        ancestors.delete(real);
      }
      else if (all || ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', '.pnpmfile.cjs', '.pnpmfile.js'].includes(entry.name)) {
        hash.update(path.relative(root, file)).update('\0').update(readOptional(file)).update('\0');
      }
    }
  };
  const ancestors = new Set([fs.realpathSync(root)]);
  visit(root);
  return hash.digest('hex');
}

function localEnv(local) {
  return {
    ...process.env,
    COZE_TARO_LOCAL_ACTIVE: local,
    COZE_TARO_SOURCE_PATH: source,
    COZE_TARO_LOCAL_MIRROR: onDrive ? '1' : '',
    COZE_WORKSPACE_PATH: local,
    // Keep the existing discoverable log/PID location in the source project.
    COZE_LOG_DIR: process.env.COZE_LOG_DIR || path.join(source, 'logs'),
    PWD: local,
    INIT_CWD: local,
    ...(onDrive ? { npm_config_store_dir: path.join(cacheRoot, 'store') } : {}),
  };
}

async function install(local, mode) {
  const state = path.join(projectCache, `${mode}.install`);
  const version = execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim();
  const fingerprint = () => digest([
    installInput(local), version, process.version, process.env.NODE_ENV,
    process.env.npm_config_production, process.env.NPM_CONFIG_PRODUCTION,
    process.env.PNPM_CONFIG_PRODUCTION,
  ].join('\n'));
  // Lifecycle scripts may generate files from arbitrary source, so do not reuse
  // their install based on dependency metadata alone. Read manifests as text here
  // (no executable hooks or private CLI dependencies in the standalone helper).
  const manifest = readOptional(path.join(local, 'package.json')).toString();
  const hasLifecycle = /"(?:install|postinstall|prepare)"\s*:/.test(manifest);
  const hasHooks = ['.pnpmfile.cjs', '.pnpmfile.js'].some(file => fs.existsSync(path.join(local, file))) ||
    /^\s*pnpmfile\s*=/m.test(readOptional(path.join(local, '.npmrc')).toString());
  if (!hasLifecycle && !hasHooks && readOptional(state).toString() === fingerprint() &&
      fs.existsSync(path.join(local, 'node_modules', '.modules.yaml'))) return;
  fs.rmSync(state, { force: true });
  const before = installInput(source);
  if (before !== installInput(local)) {
    throw new Error('Dependency inputs changed during sync; rerun dev_build.sh.');
  }
  await run('pnpm', [...installArgs, '--store-dir', path.join(cacheRoot, 'store')], local, localEnv(local));
  if (before !== installInput(source)) {
    throw new Error('Dependency inputs changed on Drive during installation; rerun dev_build.sh. Lockfile was not overwritten.');
  }
  const lockfile = path.join(local, 'pnpm-lock.yaml');
  if (fs.existsSync(lockfile) && !readOptional(lockfile).equals(readOptional(path.join(source, 'pnpm-lock.yaml')))) {
    const temporary = path.join(source, `.pnpm-lock.yaml.${process.pid}.tmp`);
    try {
      fs.copyFileSync(lockfile, temporary);
      fs.renameSync(temporary, path.join(source, 'pnpm-lock.yaml'));
    } finally { fs.rmSync(temporary, { force: true }); }
  }
  fs.writeFileSync(state, fingerprint());
}

async function watch(args) {
  const local = fs.realpathSync(process.env.COZE_TARO_LOCAL_ACTIVE || path.resolve(__dirname, '..', '..'));
  if (!onDrive) return run(args[0], args.slice(1), local);
  ensureCache();
  if (local !== path.join(fs.realpathSync(projectCache), 'dev')) {
    throw new Error(`Refusing to watch an unmanaged workspace: ${local}`);
  }
  const preparedInput = installInput(local);
  let running = true;
  let syncError;
  const command = run(args[0], args.slice(1), local).finally(() => { running = false; });
  const poll = (async () => {
    while (running && !interrupted) {
      await delay(1000);
      if (!running || interrupted) break;
      try {
        await locked(async () => {
          await sync(local);
          if (installInput(local) !== preparedInput) {
            throw new Error('Dependency inputs changed; rerun dev_build.sh and dev_run.sh before previewing.');
          }
        });
      }
      catch (error) {
        syncError = error;
        for (const child of children) stopTree(child);
        break;
      }
    }
  })();
  const results = await Promise.allSettled([command, poll]);
  if (syncError) throw syncError;
  if (results[0].status === 'rejected') throw results[0].reason;
}

async function syncOutputBack(local, outputs = outputDirs) {
  for (const output of outputs) {
    const localOutput = path.join(local, output);
    const sourceOutput = path.join(source, output);
    if (!fs.existsSync(localOutput)) continue;
    fs.rmSync(sourceOutput, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(sourceOutput), { recursive: true });
    await run('rsync', ['-a', '--delete', `${localOutput}/`, `${sourceOutput}/`], local);
  }
}

function cleanOutputs(local, outputs = outputDirs) {
  for (const output of outputs) {
    fs.rmSync(path.join(local, output), { recursive: true, force: true });
  }
}

function taroBuildOutput(args) {
  const target = args[1] === 'h5' ? 'web' : args[1];
  const output = taroOutputDirs[target];
  if (!output) throw new Error(`Unknown Taro build target: ${args[1] || ''}`);
  return output;
}

function runScript(script, local, args) {
  const scriptPath = path.join(local, '.cozeproj', 'scripts', script);
  if (script.endsWith('.cjs')) {
    return run(process.execPath, [scriptPath, ...args], local, localEnv(local));
  }
  return run('bash', [scriptPath, ...args], local, localEnv(local));
}

async function main() {
  const [action, ...args] = process.argv.slice(2);
  if (action === 'watch') return watch(args);
  if (!['prepare', 'dev', 'build', 'pack', 'validate', 'taro-build'].includes(action)) throw new Error(`Unknown Taro action: ${action}`);
  const scriptByAction = {
    prepare: 'dev_build.sh',
    dev: 'dev_run.sh',
    build: 'deploy_build.sh',
    pack: 'pack.sh',
    validate: 'validate.sh',
    'taro-build': 'taro-build.cjs',
  };
  if (!onDrive) {
    return runScript(scriptByAction[action], source, args);
  }
  ensureCache();
  const mode = action === 'validate' ? 'check' : action === 'build' || action === 'pack' || action === 'taro-build' ? 'build' : 'dev';
  const local = path.join(fs.realpathSync(projectCache), mode);
  console.log(`[taro] Source: ${source}\n[taro] Local ${mode} workspace: ${local}`);
  if (action === 'taro-build') {
    const output = taroBuildOutput(args);
    return locked(async () => {
      await sync(local);
      await install(local, mode);
      cleanOutputs(local, [output]);
      await runScript(scriptByAction[action], local, args);
      await locked(async () => {
        await syncOutputBack(local, [output]);
      }, 'output');
    }, mode);
  }
  if (action === 'validate') {
    return locked(async () => {
      await locked(async () => {
        await sync(local);
        await install(local, mode);
      });
      await runScript('validate.sh', local, args);
    }, 'check');
  }
  await locked(async () => {
    await sync(local);
    await install(local, mode);
  }, mode);
  if (action === 'build' || action === 'pack') {
    cleanOutputs(local);
  }
  await runScript(scriptByAction[action], local, args);
  if (action === 'build' || action === 'pack') {
    await locked(async () => {
      await syncOutputBack(local);
    }, 'output');
  }
}

main().catch(error => {
  console.error(`[taro] ${error.message}`);
  process.exitCode = process.exitCode || 1;
});
