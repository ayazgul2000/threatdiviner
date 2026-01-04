module.exports = {
  apps: [
    {
      name: 'api',
      cwd: 'C:/dev/threatdiviner/apps/api',
      script: 'cmd.exe',
      args: '/c pnpm start:dev',
      interpreter: 'none',
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'dashboard',
      cwd: 'C:/dev/threatdiviner/apps/dashboard',
      script: 'cmd.exe',
      args: '/c pnpm dev',
      interpreter: 'none',
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
}
