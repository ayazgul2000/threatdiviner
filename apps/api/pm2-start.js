const { spawn } = require('child_process');
const path = require('path');

const nest = spawn('node', [
  path.join(__dirname, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js'),
  'start',
  '--watch'
], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

nest.on('error', (err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

nest.on('close', (code) => {
  process.exit(code);
});
