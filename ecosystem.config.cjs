module.exports = {
  apps: [
    {
      name: 'api',
      cwd: './apps/api',
      script: 'node_modules/@nestjs/cli/bin/nest.js',
      args: 'start --watch',
      autorestart: true,
      watch: false
    },
    {
      name: 'dashboard',
      cwd: './apps/dashboard',
      script: 'node_modules/next/dist/bin/next',
      args: 'dev',
      autorestart: true,
      watch: false
    }
  ]
}
