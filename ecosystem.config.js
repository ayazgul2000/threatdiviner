module.exports = {
  apps: [
    {
      name: 'api',
      cwd: 'C:/dev/threatdiviner/apps/api',
      script: 'pm2-start.js',
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      name: 'dashboard',
      cwd: 'C:/dev/threatdiviner/apps/dashboard',
      script: 'pm2-start.js',
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
}
