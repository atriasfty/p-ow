const port = process.env.PORT || 41729;
const syncPort = process.env.SYNC_PORT || 41730;

// The deployment script sets "APP_ENV" (e.g. "prod" or "staging")
// Default to the directory basename if APP_ENV is explicitly missing
const dirName = require('path').basename(process.cwd());
const envPrefix = process.env.APP_ENV || (dirName.includes('staging') ? 'staging' : (dirName.includes('prod') ? 'prod' : dirName));

// Each environment gets its own symlink so prod and staging never share a cwd.
// deploy.sh creates current-prod or current-staging — not a shared "current".
const currentLink = `./current-${envPrefix}`;

module.exports = {
  apps: [
    {
      name: `pow-dashboard-${envPrefix}`,
      script: 'npm',
      args: `run start -- -p ${port}`,
      cwd: `${currentLink}/dashboard`,
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        APP_ENV: envPrefix,
      }
    },
    {
      name: `pow-bot-${envPrefix}`,
      script: 'npm',
      args: 'run start',
      cwd: `${currentLink}/bot`,
      watch: false,
      autorestart: true,
      env: {
        // NODE_ENV matters: the log-sync driver only suppresses
        // connection-refused alerts outside production
        NODE_ENV: 'production',
        APP_ENV: envPrefix,
        BOT_HEALTH_PORT: process.env.BOT_HEALTH_PORT || 41734
      }
    },
    {
      name: `pow-sync-${envPrefix}`,
      script: 'node',
      args: 'src/sync-server.js',
      cwd: `${currentLink}/dashboard`,
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        APP_ENV: envPrefix,
        SYNC_PORT: syncPort
      }
    },
  ],
};
