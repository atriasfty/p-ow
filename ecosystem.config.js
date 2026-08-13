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
        // Hardcoded, not `process.env.BOT_HEALTH_PORT || ...` — that fallback
        // depends on whatever shell env PM2's daemon happens to have at
        // registration time, which flipped this in practice (broke
        // Prometheus scraping + looked like an outage). Deterministic
        // per-env value instead — MUST match deploy.sh's BOT_HEALTH_PORT
        // (prod=41734, staging=41735). Prod is deliberately NOT 41732:
        // that collides with staging's SYNC_PORT if staging is ever
        // deployed on the same box (see deploy.sh's own comment on this).
        BOT_HEALTH_PORT: envPrefix === 'staging' ? 41735 : 41734
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
