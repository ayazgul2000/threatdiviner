module.exports = {
  apps: [{
    name: 'api',
    script: 'node_modules/@nestjs/cli/bin/nest.js',
    args: 'start --watch',
    cwd: 'C:/dev/threatdiviner/apps/api',
    watch: false,
    env: {
      NODE_ENV: 'development'
    }
  }]
};
