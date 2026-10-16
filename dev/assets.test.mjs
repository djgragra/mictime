import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { whatsNew, isNewer } from '../src/updater.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = (...p) => path.join(root, ...p);
const read = (...p) => fs.readFileSync(file(...p), 'utf8');
const pkg = JSON.parse(read('package.json'));

test('the CHANGELOG is packaged and has a What\'s new entry for the current version', () => {
  assert.ok(pkg.build.files.includes('CHANGELOG.md'));
  const wn = whatsNew(read('CHANGELOG.md'), pkg.version);
  assert.ok(wn && wn.bullets.length > 0, `CHANGELOG.md needs "## ${pkg.version} — date" with bullets`);
  assert.match(wn.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('icon files exist and the PNG icon is 1024 x 1024', () => {
  for (const f of ['icon.png', 'icon-mac.png', 'icon.ico', 'icon.icns', 'logo.svg', 'linux-icons/512x512.png']) assert.ok(fs.existsSync(file('assets', f)), f);
  const png = fs.readFileSync(file('assets', 'icon.png'));
  assert.equal(png.readUInt32BE(16), 1024);
  assert.equal(png.readUInt32BE(20), 1024);
});

test('installer names follow the standard', () => {
  assert.equal(pkg.build.productName, 'MicTime');
  assert.equal(pkg.build.nsis.artifactName, 'MicTime-Setup-${version}.exe');
  assert.equal(pkg.build.mac.artifactName, 'MicTime-${version}-${arch}.${ext}');
  assert.equal(pkg.scripts.test, 'node --test dev/*.test.mjs');
});

test('the page has a strict CSP, no inline script, no inline style, no remote address', () => {
  const html = read('renderer', 'index.html');
  assert.match(html, /Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'/);
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'inline script');
  assert.ok(!/\sstyle=/i.test(html), 'inline style attribute');
  assert.ok(!/https?:\/\//i.test(html.replace(/<meta[^>]*Content-Security[^>]*>/i, '')), 'remote address in the page');
  assert.ok(!/@import|url\(\s*['"]?https?:/i.test(read('renderer', 'style.css')));
});

test('CLAUDE.md points at the standard and is not git-ignored', () => {
  const md = read('CLAUDE.md');
  assert.ok(md.includes('djgragra/garage-hub') && md.includes('apps/STANDARD.md'));
  assert.ok(!/(^|\n)\s*CLAUDE\.md\s*($|\n)/.test(read('.gitignore')));
});

test('shared modules carry their garage-common version line', () => {
  const first = (...f) => read(...f).split('\n')[0];
  assert.equal(first('src', 'updater.js'), '// garage-common: updater 2');
  assert.equal(first('src', 'backup.js'), '// garage-common: backup 1');
  assert.equal(first('src', 'logs.js'), '// garage-common: logs 1');
  assert.equal(first('src', 'support.js'), '// garage-common: support 1');
  for (const f of ['index', 'midi', 'keys', 'level', 'stopwatch']) assert.equal(first('src', 'trigger', `${f}.js`), '// garage-common: trigger 1', f);
});

test('src/trigger is independent of Electron and of the rest of the app (it is copied into other apps)', () => {
  for (const f of fs.readdirSync(file('src', 'trigger'))) {
    const src = read('src', 'trigger', f);
    for (const m of src.matchAll(/from\s+'([^']+)'/g)) assert.ok(m[1].startsWith('./'), `${f} imports ${m[1]}`);
    assert.ok(!/\brequire\(|process\.|electron/.test(src.replace(/\/\/.*$/gm, '')), f);
  }
});

test('the trigger module reaches the page through ES modules that are packaged', () => {
  assert.ok(pkg.build.files.includes('src/**/*'));
  assert.match(read('renderer', 'js', 'signals.js'), /from '\.\.\/\.\.\/src\/trigger\/index\.js'/);
});

test('MIDI is read-only in the page: no sysex request and no output', () => {
  const src = read('renderer', 'js', 'signals.js');
  assert.match(src, /requestMIDIAccess\(\{ sysex: false \}\)/);
  assert.ok(!/outputs|\.send\(/.test(src), 'MicTime never sends MIDI');
});

test('audio: the analyser is not connected to an output and nothing is recorded', () => {
  const src = read('renderer', 'js', 'signals.js');
  assert.ok(!/destination|MediaRecorder|createMediaStreamDestination|AudioWorklet/.test(src.replace(/\/\/.*$/gm, '')));
});

test('docs exist: manual and MIDI specification', () => {
  for (const f of ['README.md', 'CHANGELOG.md', 'LICENSE', 'docs/MANUAL.md', 'docs/MIDI-SPEC.md']) assert.ok(fs.existsSync(file(f)), f);
});

test('versions: a beta is 0.N.P and published as a pre-release; any public YY.M.N is newer than every beta', () => {
  assert.match(pkg.version, /^(0\.\d+\.\d+|\d{2}\.\d{1,2}\.\d+)$/);
  assert.ok(isNewer('26.10.1', '0.9.9') && !isNewer('0.9.9', '26.10.1') && isNewer('0.2.0', '0.1.9'));
  assert.match(read('.github', 'workflows', 'build-installers.yml'), /prerelease: .*startsWith\(github\.event\.inputs\.release_version, '0\.'\)/);
});
