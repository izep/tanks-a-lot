// Simple dev orchestrator to rebuild once and then run Watch + Serve in parallel.
const { spawn, spawnSync } = require('node:child_process');

const isWindows = process.platform === 'win32';
const processes = [];
let shuttingDown = false;

const runSync = (cmd, args) => {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: isWindows });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const killChild = (child) => {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }

  if (!child.kill('SIGINT')) {
    child.kill('SIGTERM');
  }

  if (isWindows) {
    spawn('taskkill', ['/pid', child.pid.toString(), '/t', '/f'], {
      stdio: 'ignore',
      shell: true,
    });
  }
};

const shutdown = () => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  processes.forEach(killChild);
};

const startChild = (label) => {
  const child = spawn('npm', ['run', label], {
    stdio: 'inherit',
    shell: isWindows,
    env: process.env,
  });

  child.on('error', (error) => {
    console.error(`[dev] Failed to start ${label}: ${error.message}`);
    shutdown();
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (code && code !== 0) {
      console.error(`[dev] ${label} exited with code ${code}`);
    }
    if (signal) {
      console.warn(`[dev] ${label} terminated via ${signal}`);
    }
    shutdown();
    process.exit(code ?? 0);
  });

  processes.push(child);
};

runSync('npm', ['run', 'build']);

startChild('watch');
startChild('serve');

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});

process.on('exit', shutdown);
