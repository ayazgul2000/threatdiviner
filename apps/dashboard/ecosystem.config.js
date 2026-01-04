module.exports = {
  apps: [{
    name: 'dashboard',
    script: 'node_modules/next/dist/bin/next',
    args: 'dev',
    cwd: 'C:/dev/threatdiviner/apps/dashboard',
    watch: false,
    env: {
      NODE_ENV: 'development'
    }
  }]
};
