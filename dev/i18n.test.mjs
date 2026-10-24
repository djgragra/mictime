import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'renderer');
const ctx = vm.createContext({ document: { documentElement: {}, querySelectorAll: () => [] } });
ctx.window = ctx; // in the browser `window` is the global object
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'i18n.js'), 'utf-8'), ctx);
const { DICT } = ctx.GC;

test('every language has exactly the English keys', () => {
  const en = Object.keys(DICT.en).sort();
  for (const lang of ['it', 'es']) assert.deepEqual(Object.keys(DICT[lang]).sort(), en, lang);
});

test('placeholders match between languages', () => {
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const [k, v] of Object.entries(DICT.en)) for (const lang of ['it', 'es']) assert.equal(ph(DICT[lang][k]), ph(v), `${lang} ${k}`);
});

test('no empty texts, and no English left in the Italian and Spanish updater texts', () => {
  for (const lang of Object.keys(DICT)) for (const [k, v] of Object.entries(DICT[lang])) assert.ok(v.trim(), `${lang} ${k}`);
  assert.notEqual(DICT.it['upd.skip'], DICT.en['upd.skip']);
  assert.notEqual(DICT.es['upd.skip'], DICT.en['upd.skip']);
});

test('every key used by the interface exists', () => {
  const used = new Set();
  const prefix = /^(common|hdr|settings|phase|ctl|hint|pill|sig|act|sec|gen|midi|key|audio|bk|about|whatsnew|upd|prog|col|cmp|sp|alert)\./;
  const files = fs.readdirSync(path.join(root, 'js')).map((f) => path.join(root, 'js', f)).filter((f) => !f.endsWith('i18n.js'));
  for (const f of [...files, path.join(root, 'index.html')]) {
    const src = fs.readFileSync(f, 'utf-8');
    for (const m of src.matchAll(/['"]([a-z]+(?:\.[A-Za-z0-9]+)+)['"]/g)) if (prefix.test(m[1])) used.add(m[1]);
    for (const m of src.matchAll(/data-i18n(?:-title)?="([^"]+)"/g)) used.add(m[1]);
  }
  // keys built at run time
  for (const s of ['idle', 'running', 'holding']) used.add('phase.' + s);
  for (const s of ['toggle', 'start', 'stop', 'reset', 'next', 'prev', 'restart']) { used.add('sig.name.' + s); used.add('act.' + s); }
  for (const s of ['normal', 'warn', 'over', 'idle']) used.add('col.' + s);
  used.add('sec.programs');
  for (const s of ['general', 'programs', 'signals', 'updates', 'backup', 'about']) used.add('sec.' + s);
  for (const s of ['unsupported', 'failed', 'denied']) used.add('midi.' + s);
  for (const s of ['stOff', 'stStarting', 'stListening', 'stDenied', 'stUnavailable']) used.add('audio.' + s);
  const missing = [...used].filter((k) => !(k in DICT.en));
  assert.deepEqual(missing, []);
  assert.ok(used.size > 80);
  // and nothing in the dictionary is dead weight
  const all = fs.readdirSync(path.join(root, 'js')).filter((f) => !f.endsWith('i18n.js')).map((f) => fs.readFileSync(path.join(root, 'js', f), 'utf-8')).join('\n') + fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
  const dynamic = /^(phase\.|sig\.name\.|act\.|sec\.|col\.(normal|warn|over|idle)$|midi\.(unsupported|failed|denied)|audio\.st)/;
  const dead = Object.keys(DICT.en).filter((k) => !dynamic.test(k) && !all.includes(`'${k}'`) && !all.includes(`"${k}"`));
  assert.deepEqual(dead, []);
});
