const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { cleanup } = require('./cleanup-releases.cjs');

test('preserves active environments and ignores archives and unrelated directories', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pow-cleanup-'));
  try {
    const releases = path.join(root, 'releases');
    fs.mkdirSync(releases);
    const names = ['20260901000000', '20260902000000', '20260903000000', '20260904000000', '20260905000000', '20260906000000', '20260907000000', 'releases', '20260905-candidate'];
    for (const name of names) fs.mkdirSync(path.join(releases, name));
    for (const name of ['amble-a.tar.gz', 'amble-b.tar.gz']) fs.writeFileSync(path.join(releases, name), 'backup');
    fs.symlinkSync('releases/20260901000000', path.join(root, 'current-prod'));
    fs.symlinkSync(path.join(releases, '20260902000000'), path.join(root, 'current-staging'));
    fs.symlinkSync('releases/20260101000000', path.join(root, 'current'));
    cleanup(root, 3);
    for (const name of names.filter(n => !['20260903000000', '20260904000000'].includes(n))) assert.ok(fs.existsSync(path.join(releases, name)), name);
    for (const name of ['20260903000000', '20260904000000']) assert.ok(!fs.existsSync(path.join(releases, name)), name);
    assert.equal(fs.readFileSync(path.join(releases, 'amble-a.tar.gz'), 'utf8'), 'backup');
    assert.throws(() => cleanup(root, 0));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
