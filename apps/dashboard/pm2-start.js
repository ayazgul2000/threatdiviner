const { spawn } = require('child_process');
const path = require('path');

const next = spawn('node', [
  path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next'),
  'dev'
], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

next.on('error', (err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

next.on('close', (code) => {
  process.exit(code);
});
