import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const app = process.argv[2];
if (!['web', 'cms'].includes(app)) throw new Error('Expected web or cms');
const root = resolve('apps', app);
const standalone = resolve(root, '.next/standalone');
const server = resolve(standalone, 'apps', app, 'server.js');
if (!existsSync(server))
  throw new Error('Build the application before starting it');
cpSync(
  resolve(root, '.next/static'),
  resolve(standalone, 'apps', app, '.next/static'),
  { recursive: true },
);
cpSync(resolve(root, 'public'), resolve(standalone, 'apps', app, 'public'), {
  recursive: true,
});
const child = spawn(process.execPath, [server], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    HOSTNAME: '127.0.0.1',
    PORT: app === 'web' ? '3000' : '3001',
  },
});
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => child.kill(signal));
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
