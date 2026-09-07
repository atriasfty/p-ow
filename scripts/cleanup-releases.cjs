const fs = require('node:fs');
const path = require('node:path');

function cleanup(root, keep = 3) {
  if (!Number.isInteger(keep) || keep < 1) throw new Error('Invalid release retention');
  root = path.resolve(root);
  const releases = path.join(root, 'releases');
  const protectedPaths = new Set();
  for (const name of ['current', 'current-prod', 'current-staging']) {
    const link = path.join(root, name);
    try {
      protectedPaths.add(fs.realpathSync(link));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // A broken link still identifies a release that must be preserved.
      try { protectedPaths.add(path.resolve(root, fs.readlinkSync(link))); }
      catch (linkError) { if (linkError.code !== 'ENOENT') throw linkError; }
    }
  }
  const candidates = fs.readdirSync(releases, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{14}$/.test(entry.name))
    .map(entry => entry.name).sort().reverse();
  for (const name of candidates.slice(keep)) {
    const release = path.join(releases, name);
    if (protectedPaths.has(fs.realpathSync(release))) continue;
    console.log(`Deleting old release: ${release}`);
    fs.rmSync(release, { recursive: true });
  }
}

if (require.main === module) cleanup(process.argv[2], Number(process.argv[3] || 3));
module.exports = { cleanup };
