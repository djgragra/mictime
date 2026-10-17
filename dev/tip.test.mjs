import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tipUrl, TIP_LINKS, isAllowedExternal } from '../src/schema.js';

const REPO = 'djgragra/mictime';

test('the tip jar link follows the app language and falls back to English', () => {
  assert.equal(tipUrl('en'), 'https://onairgarage.com/support/');
  assert.equal(tipUrl('it'), 'https://onairgarage.com/it/support/');
  assert.equal(tipUrl('es'), 'https://onairgarage.com/es/support/');
  assert.equal(tipUrl('fr'), TIP_LINKS.en);
});

test('only the three tip jar pages open besides the project links, never a payment or other link', () => {
  for (const url of Object.values(TIP_LINKS)) assert.ok(isAllowedExternal(url, REPO), url);
  for (const url of ['https://onairgarage.com/support', 'https://onairgarage.com/support/?x=1', 'https://onairgarage.com/fr/support/', 'https://buy.stripe.com/abc', 'http://onairgarage.com/support/', 'javascript:alert(1)', '', null, undefined, 42]) {
    assert.equal(isAllowedExternal(url, REPO), false, String(url));
  }
  assert.ok(isAllowedExternal('https://github.com/djgragra/mictime/releases/tag/v26.10.2', REPO));
});

test('the tip card texts exist in the three languages and keep the site wording', () => {
  const src = fs.readFileSync(new URL('../renderer/js/i18n.js', import.meta.url), 'utf8');
  const want = {
    en: ['Useful to you? A coffee for the mechanics is always welcome.', 'Tip jar'],
    it: ['Ti è utile? Un caffè per i meccanici è sempre ben accetto.', 'Salvadanaio'],
    es: ['¿Te resulta útil? Un café para los mecánicos siempre es bienvenido.', 'Hucha']
  };
  for (const [lang, [text, btn]] of Object.entries(want)) {
    assert.ok(src.includes(`'about.tipText': '${text}'`), `${lang} text`);
    assert.ok(src.includes(`'about.tipBtn': '${btn}'`), `${lang} button`);
  }
});

test('the jar picture ships with the app', () => {
  assert.ok(fs.existsSync(new URL('../renderer/img/tip-jar.png', import.meta.url)));
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.build.files.includes('renderer/**/*'));
});
