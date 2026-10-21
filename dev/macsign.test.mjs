import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');

test('macOS: the ad-hoc signature hook is wired into the build and only acts on a Mac app', async () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.build.afterPack, 'dev/sign-adhoc.cjs');
  assert.ok(fs.existsSync(new URL(pkg.build.afterPack, root)));
  const hook = createRequire(import.meta.url)('./sign-adhoc.cjs').default;
  assert.equal(await hook({ electronPlatformName: 'win32' }), undefined); // nothing on Windows
  assert.equal(await hook({ electronPlatformName: 'linux' }), undefined);
  const wf = read('.github/workflows/build-installers.yml');
  assert.match(wf, /codesign --verify --deep --strict/, 'the workflow checks the apps inside the disk images');
});

test('tip card: the jar is a second link, same URL as the button, hidden from keyboard and screen readers', () => {
  const src = read('renderer/js/settings.js');
  const jar = src.match(/h\('button', \{ class: 'tip-jarbtn'[^\n]*\n[^\n]*tip-jar[^\n]*/);
  assert.ok(jar, 'jar button');
  assert.match(jar[0], /tabindex: '-1'/);
  assert.match(jar[0], /'aria-hidden': 'true'/);
  assert.match(jar[0], /window\.api\.links\.open\(tipUrl\(GC\.state\.lang\)\)/);
  assert.match(jar[0], /alt: ''/);
  assert.match(src, /class: 'tip-pill'[^\n]*window\.api\.links\.open\(tipUrl\(GC\.state\.lang\)\)/, 'the pill uses the same call');
});

test('tip card: the jar tilts on hover and stays still with reduced motion', () => {
  const css = read('renderer/style.css');
  assert.match(css, /\.tip-jarbtn:hover \{ transform: rotate\(-4deg\) scale\(1\.06\); \}/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.tip-jarbtn \{ transition: none; \} \.tip-jarbtn:hover \{ transform: none; \} \}/);
});
