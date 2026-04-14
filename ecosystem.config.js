const port = process.env.PORT || 41729;

module.exports = {
  apps: [
    {
      name: 'pow-dashboard',
      script: 'npm',
      args: `run start -- -p ${port}`,
      cwd: './current/dashboard',
      watch: false,
      autorestart: true,
    },
    {
      name: 'pow-bot',
      script: 'npm',
      args: 'run start',
      cwd: './current/bot',
      watch: false,
      autorestart: true,
    },
    {
      name: 'pow-sync',
      script: 'node',
      args: 'src/sync-server.js',
      cwd: './current/dashboard',
      watch: false,
      autorestart: true,
      env: {
        SYNC_PORT: 41730
      }
    },
  ],
};
