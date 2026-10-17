// Settings: General · Signals · Updates · Backup · Help & About (the standard order of apps/COMMON-FEATURES.md, 5.1).
import { bindingLabel, acceleratorFromEvent, globalAllowed } from '../../src/trigger/index.js';
import { tipUrl } from '../../src/schema.js';

const GC = window.GC;
const { h, $ } = GC;
const t = (k, p) => GC.t(k, p);

const TABS = ['general', 'programs', 'signals', 'updates', 'backup', 'about'];
let tab = 'general';
let keyCapture = null; // { name, timer }
let learning = ''; // binding name being learned
let notice = ''; // short message under the tab title

const S = () => GC.state.settings;
const save = (patch) => GC.save(patch).then(() => draw());

// ---- small builders ----
const row = (label, control, hint) => h('div', { class: 'field' }, h('label', { text: label }), control, hint ? h('div', { class: 'hint', text: hint }) : null);
const check = (label, value, onchange, hint) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!value, onchange: (e) => onchange(e.target.checked) }), h('span', { text: label }), hint ? h('span', { class: 'hint inline', text: hint }) : null);
const select = (options, value, onchange) => h('select', { onchange: (e) => onchange(e.target.value) }, options.map(([v, l]) => h('option', { value: v, text: l, selected: v === value })));
const number = (value, min, max, step, onchange) => h('input', { type: 'number', value, min, max, step, onchange: (e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onchange(n); } });
const card = (title, ...kids) => h('section', { class: 'card' }, h('h3', { text: title }), ...kids);
const btn = (key, onclick, cls = 'ghost', extra = {}) => h('button', { class: `btn ${cls} compact`, type: 'button', text: t(key), onclick, ...extra });

// ---- General ----
function general() {
  const s = S();
  const box = h('div', { class: 'tab' });
  box.append(
    row(t('gen.language'), select([['en', 'English'], ['it', 'Italiano'], ['es', 'Español']], s.language, (v) => save({ language: v }))),
    row(t('gen.theme'), select([['dark', t('gen.themeDark')], ['light', t('gen.themeLight')], ['system', t('gen.themeSystem')]], s.theme, (v) => save({ theme: v }))),
    card(t('gen.timerTitle'),
      row(t('gen.mode'), select([['toggle', t('gen.modeToggle')], ['separate', t('gen.modeSeparate')]], s.timer.mode, (v) => save({ timer: { mode: v } })), t('gen.modeHint')),
      check(t('gen.holdForever'), s.timer.holdForever, (v) => save({ timer: { holdForever: v } }), t('gen.holdForeverHint')),
      row(t('gen.hold'), Object.assign(number(s.timer.holdSeconds, 1, 600, 1, (n) => save({ timer: { holdSeconds: n } })), { disabled: s.timer.holdForever }), t('gen.holdHint')),
      row(t('gen.debounce'), number(s.timer.debounceMs, 0, 2000, 50, (n) => save({ timer: { debounceMs: n } })), t('gen.debounceHint'))
    ),
    check(t('gen.onTop'), s.alwaysOnTop, (v) => save({ alwaysOnTop: v })),
    h('div', { class: 'row-start' }, btn('gen.reset', async () => { const r = await window.api.settings.reset(); if (r.ok) { GC.adopt(r); draw(); } }))
  );
  return box;
}

// ---- Signals ----
const NAMES = (mode) => [...(mode === 'separate' ? ['start', 'stop'] : ['toggle']), 'reset', 'next', 'prev', 'restart'];
const nameLabel = (n) => t(`sig.name.${n}`);

function midiCard() {
  const s = S();
  const sig = GC.signals;
  const status = sig.midi.error ? t({ unsupported: 'midi.unsupported', failed: 'midi.failed' }[sig.midi.error] || 'midi.denied') : !sig.midi.inputs.length ? t('midi.noInputs') : t('midi.inputsFound', { n: sig.midi.inputs.length });
  const inputs = [['', t('midi.allInputs')], ...[...new Set(sig.midi.inputs)].map((n) => [n, n])];
  if (s.midi.input && !inputs.some(([v]) => v === s.midi.input)) inputs.push([s.midi.input, `${s.midi.input} (${t('midi.missing')})`]);
  const rows = NAMES(s.timer.mode).map((name) => {
    const b = s.midi.bindings[name];
    const isLearning = learning === name && sig.midi.learn;
    return h('div', { class: 'bind' },
      h('div', { class: 'bind-name', text: nameLabel(name) }),
      h('div', { class: 'bind-val' + (b ? '' : ' empty'), text: isLearning ? t('midi.listening') : b ? bindingLabel(b, t('midi.anyChannel')) : t('midi.unassigned') }),
      isLearning
        ? btn('midi.cancel', () => { sig.stopLearn(); learning = ''; draw(); })
        : btn('midi.learn', () => { learning = name; sig.startLearn(name, (nb) => { learning = ''; save({ midi: { bindings: { [name]: { ...nb } } } }); }); draw(); }, 'ghost'),
      b ? h('select', { class: 'ch', title: t('midi.channel'), onchange: (e) => save({ midi: { bindings: { [name]: { ...b, channel: Number(e.target.value) } } } }) },
        [h('option', { value: 0, text: t('midi.anyChannel'), selected: b.channel === 0 }), ...Array.from({ length: 16 }, (_, i) => h('option', { value: i + 1, text: `ch ${i + 1}`, selected: b.channel === i + 1 }))]) : h('span'),
      b ? btn('common.clear', () => save({ midi: { bindings: { [name]: null } } })) : h('span')
    );
  });
  const mon = sig.midi.monitor.slice(0, 12).map((m) => h('tr', {},
    h('td', { text: new Date(m.t).toLocaleTimeString(GC.state.locale, { hour12: false }) }),
    m.raw !== undefined
      ? [h('td', { text: t('midi.raw') }), h('td', { text: '' }), h('td', { text: '' }), h('td', { text: m.raw }), h('td', { class: 'act', text: '' })]
      : [h('td', { text: m.msg.type === 'note' ? 'Note' : m.msg.type === 'cc' ? 'CC' : 'PC' }),
        h('td', { text: String(m.msg.channel) }),
        h('td', { text: String(m.msg.number) }),
        h('td', { text: m.msg.type === 'pc' ? '–' : String(m.msg.value) }),
        h('td', { class: 'act', text: m.action ? t(`act.${m.action}`) : '' })]));
  return card('MIDI',
    check(t('midi.enable'), s.midi.enabled, (v) => save({ midi: { enabled: v } })),
    row(t('midi.input'), h('div', { class: 'inline-row' }, select(inputs, s.midi.input, (v) => save({ midi: { input: v } })), btn('midi.refresh', () => { sig.refreshMidi(); draw(); })), status),
    h('p', { class: 'hint', text: t(s.timer.mode === 'separate' ? 'midi.helpSeparate' : 'midi.helpToggle') }),
    h('p', { class: 'hint', text: t('midi.helpProgram') }),
    ...rows,
    h('div', { class: 'monitor' }, h('div', { class: 'monitor-title', text: t('midi.monitor') }),
      check(t('midi.showAll'), sig.midi.showRaw, (v) => { sig.midi.showRaw = v; draw(); }),
      mon.length ? h('table', {}, h('thead', {}, h('tr', {}, ['midi.colTime', 'midi.colType', 'midi.colCh', 'midi.colNum', 'midi.colVal', 'midi.colAction'].map((k) => h('th', { text: t(k) })))), h('tbody', {}, mon)) : h('div', { class: 'hint', text: t('midi.monitorEmpty') })),
    h('div', { class: 'ports' }, h('div', { class: 'monitor-title', text: t('midi.ports') }),
      sig.midi.ports.length
        ? h('table', {}, h('thead', {}, h('tr', {}, ['midi.colName', 'midi.colState', 'midi.colConn'].map((k) => h('th', { text: t(k) })))),
          h('tbody', {}, sig.midi.ports.map((p) => h('tr', {}, h('td', { text: p.name }), h('td', { text: String(p.state) }), h('td', { text: String(p.connection) })))))
        : h('div', { class: 'hint', text: t('midi.noInputs') }),
      h('p', { class: 'hint', text: t('midi.portsHint') })),
    h('p', { class: 'hint', text: t('midi.specLink') }),
    btn('midi.openSpec', () => window.api.links.open('https://github.com/djgragra/mictime/blob/main/docs/MIDI-SPEC.md'))
  );
}

function stopKeyCapture() {
  if (!keyCapture) return;
  clearTimeout(keyCapture.timer);
  document.removeEventListener('keydown', keyCapture.fn, true);
  keyCapture = null;
  GC.signals.setCapturing(false);
  window.api.keys.capture(false);
}

function startKeyCapture(name) {
  stopKeyCapture();
  GC.signals.setCapturing(true);
  window.api.keys.capture(true); // the system shortcuts are released while the new key is chosen
  const fn = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.code === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) { stopKeyCapture(); draw(); return; }
    const accel = acceleratorFromEvent(e);
    if (!accel) return; // only a modifier so far
    stopKeyCapture();
    save({ key: { keys: { [name]: accel } } });
  };
  document.addEventListener('keydown', fn, true);
  keyCapture = { name, fn, timer: setTimeout(() => { stopKeyCapture(); draw(); }, 15000) };
}

function keyCard() {
  const s = S();
  const rows = NAMES(s.timer.mode).map((name) => {
    const accel = s.key.keys[name];
    const capturing = keyCapture?.name === name;
    const dup = accel && Object.entries(s.key.keys).some(([n, a]) => n !== name && a === accel && NAMES(s.timer.mode).includes(n));
    let status = '';
    if (accel && s.key.global) status = GC.state.keyStatus.failed.includes(accel) ? t('key.refused') : !globalAllowed(accel) ? t('key.windowOnly') : GC.state.keyStatus.global[accel] ? t('key.isGlobal') : '';
    return h('div', { class: 'bind' },
      h('div', { class: 'bind-name', text: nameLabel(name) }),
      h('div', { class: 'bind-val' + (accel ? '' : ' empty'), text: capturing ? t('key.press') : accel || t('midi.unassigned') }),
      capturing ? btn('midi.cancel', () => { stopKeyCapture(); draw(); }) : btn('key.set', () => { startKeyCapture(name); draw(); }),
      accel ? btn('common.clear', () => save({ key: { keys: { [name]: '' } } })) : h('span'),
      h('div', { class: 'bind-note' + (dup || (accel && s.key.global && (GC.state.keyStatus.failed.includes(accel) || !globalAllowed(accel))) ? ' warn' : ''), text: dup ? t('key.duplicate') : status })
    );
  });
  return card(t('key.title'),
    check(t('key.enable'), s.key.enabled, (v) => save({ key: { enabled: v } })),
    check(t('key.global'), s.key.global, (v) => save({ key: { global: v } }), t('key.globalHint')),
    ...rows,
    h('p', { class: 'hint', text: t('key.limits') })
  );
}

const meter = { fill: null, mark: null, text: null };
function audioCard() {
  const s = S();
  const a = GC.signals.audio;
  const devices = [['', t('audio.default')], ...a.devices.filter((d) => d.id && d.id !== 'default').map((d) => [d.id, d.label || t('audio.unnamed')])];
  if (s.audio.device && !devices.some(([v]) => v === s.audio.device)) devices.push([s.audio.device, `${s.audio.deviceLabel || s.audio.device} (${t('midi.missing')})`]);
  const statusKey = { off: 'audio.stOff', starting: 'audio.stStarting', listening: 'audio.stListening', denied: 'audio.stDenied', unavailable: 'audio.stUnavailable' }[a.status] || 'audio.stOff';
  const fill = h('div', { class: 'meter-fill' });
  const mark = h('div', { class: 'meter-mark' });
  const text = h('span', { class: 'meter-text' });
  Object.assign(meter, { fill, mark, text });
  const m = h('div', { class: 'meter' }, fill, mark);
  paintMeter();
  return card(t('audio.title'),
    check(t('audio.enable'), s.audio.enabled, (v) => save({ audio: { enabled: v } })),
    row(t('audio.input'), select(devices, s.audio.device, (v) => { const d = a.devices.find((x) => x.id === v); save({ audio: { device: v, deviceLabel: d?.label || '' } }).then(() => GC.signals.restartAudio()); })),
    row(t('audio.threshold'), h('div', { class: 'inline-row' }, h('input', { type: 'range', min: -80, max: -5, step: 1, value: s.audio.thresholdDb, oninput: (e) => { meter.pending = Number(e.target.value); paintMeter(); }, onchange: (e) => save({ audio: { thresholdDb: Number(e.target.value) } }) }), h('span', { class: 'mono', text: `${s.audio.thresholdDb} dB` })), t('audio.thresholdHint')),
    row(t('audio.hold'), number(s.audio.holdMs / 1000, 0.2, 60, 0.1, (n) => save({ audio: { holdMs: Math.round(n * 1000) } })), t('audio.holdHint')),
    h('div', { class: 'field' }, m, text),
    h('div', { class: 'msg ' + (a.status === 'listening' ? 'ok' : a.status === 'denied' || a.status === 'unavailable' ? 'err' : ''), text: t(statusKey) }),
    h('p', { class: 'hint', text: t('audio.privacy') })
  );
}

function paintMeter() {
  if (!meter.fill?.isConnected) return;
  const a = GC.signals.audio;
  const pct = (db) => Math.max(0, Math.min(100, ((db + 80) / 80) * 100));
  meter.fill.style.width = `${pct(a.db)}%`;
  meter.fill.classList.toggle('open', a.open);
  meter.mark.style.left = `${pct(meter.pending ?? S().audio.thresholdDb)}%`;
  meter.text.textContent = a.status === 'listening' ? `${Math.round(Math.max(-80, a.db))} dB` : '';
}

function signals() {
  return h('div', { class: 'tab' }, midiCard(), keyCard(), audioCard());
}

// ---- Updates ----
function updatesTab() {
  const box = h('div', { class: 'tab' });
  const body = h('div', { class: 'upd-box' });
  box.append(
    h('p', { class: 'hint', text: t('upd.intro') }),
    check(t('upd.auto'), S().checkUpdates, (v) => save({ checkUpdates: v }), t('upd.autoHint')),
    h('div', { class: 'upd-last', text: GC.updates.lastCheckText() }),
    h('div', { class: 'row-start' }, h('button', { class: 'btn compact', type: 'button', text: GC.updates.isChecking() ? t('upd.checking') : t('upd.check'), onclick: async (e) => { e.target.disabled = true; await GC.updates.check(); draw(); } })),
    body
  );
  GC.updates.mountBox(body);
  return box;
}

// ---- Backup ----
function backupTab() {
  const msg = h('div', { class: 'msg' });
  return h('div', { class: 'tab' },
    card(t('bk.title'),
      h('p', { class: 'hint', text: t('bk.note') }),
      h('div', { class: 'row-start' },
        btn('bk.export', async () => { const r = await window.api.backup.export(); if (r.ok) { msg.className = 'msg ok'; msg.textContent = t('bk.exported'); } else if (!r.canceled) { msg.className = 'msg err'; msg.textContent = t('bk.error'); } }, 'btn-main'),
        btn('bk.import', async () => {
          const r = await window.api.backup.import();
          if (r.ok) { GC.adopt(r); notice = t('bk.imported'); draw(); }
          else if (!r.canceled) { msg.className = 'msg err'; msg.textContent = t(r.error === 'foreign' ? 'bk.foreign' : 'bk.error'); }
        }, 'ghost')),
      msg,
      h('p', { class: 'hint', text: t('bk.contents') }))
  );
}

// ---- Help & About ----
function aboutTab() {
  const box = h('div', { class: 'tab' });
  const info = h('div', { class: 'about-version', text: '…' });
  const copied = h('div', { class: 'msg' });
  window.api.app.info().then((i) => { info.textContent = `${t('about.version', { v: i.version })} · ${i.platform} ${i.arch}`; });
  const link = (key, url) => h('li', {}, h('a', { href: '#', text: t(key), onclick: (e) => { e.preventDefault(); window.api.links.open(url); } }));
  box.append(
    h('div', { class: 'about-head' }, h('img', { class: 'about-mark', src: 'img/logo.svg', alt: '' }), h('div', {}, h('div', { class: 'about-name', text: 'MicTime' }), info)),
    h('p', { text: t('about.desc') }),
    h('p', { class: 'hint', text: t('about.author') }),
    h('p', { class: 'hint', text: t('about.license') }),
    card(t('about.links'), h('ul', { class: 'links' },
      link('about.toolPage', 'https://onairgarage.com/tools/mictime/'),
      link('about.releases', 'https://github.com/djgragra/mictime/releases'),
      link('about.manual', 'https://github.com/djgragra/mictime/blob/main/docs/MANUAL.md'),
      link('about.spec', 'https://github.com/djgragra/mictime/blob/main/docs/MIDI-SPEC.md'),
      h('li', {}, h('span', { text: 'hello@onairgarage.com' })))),
    card(t('about.support'),
      h('div', { class: 'row-start' },
        btn('about.copySupport', async () => { const text = await window.api.app.supportInfo(); await window.api.clipboard.write(text); copied.className = 'msg ok'; copied.textContent = t('about.copied'); }),
        btn('about.openLogs', async () => { const r = await window.api.app.openLogs(); if (!r.ok) { copied.className = 'msg err'; copied.textContent = t('about.logsFailed'); } }),
        btn('upd.check', async () => { await GC.updates.check(); copied.className = 'msg ok'; copied.textContent = GC.updates.hasUpdate() ? t('upd.foundSee') : t('upd.uptodate'); })),
      copied,
      h('p', { class: 'hint', text: t('about.supportHint') })),
    card(t('about.privacyTitle'), h('p', { text: t('about.privacy') })),
    card(t('about.unsignedTitle'), h('p', { text: t('about.unsigned') })),
    card(t('about.credits'), h('p', { text: t('about.creditsText') })),
    h('section', { class: 'tip-card' },
      h('img', { class: 'tip-jar', src: 'img/tip-jar.png', alt: '', width: 80, height: 59 }),
      h('div', { class: 'tip-body' },
        h('p', { class: 'tip-text', text: t('about.tipText') }),
        h('button', { class: 'tip-pill', type: 'button', text: t('about.tipBtn'), onclick: () => window.api.links.open(tipUrl(GC.state.lang)) })))
  );
  return box;
}


// ---- Programs: steps with limits, colours, warnings ----
const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const DEFAULT_HEX = { normal: '#f1f4fa', warn: '#f2b441', over: '#ef4444', idle: '#3a4256' }; // what the picker shows when no colour is chosen (dark theme)
let confirmDelete = false;

function programsTab() {
  const s = S();
  const box = h('div', { class: 'tab' });
  const progs = s.programs;
  const cur = progs.find((p) => p.id === s.activeProgram) || null;
  const edit = (fn) => { const all = structuredClone(S().programs); const p = all.find((x) => x.id === S().activeProgram); if (p) fn(p); return save({ programs: all }); };

  const options = [['', t('prog.none')], ...progs.map((p) => [p.id, p.name])];
  box.append(
    card(t('prog.title'),
      h('p', { class: 'hint', text: t('prog.intro') }),
      row(t('prog.active'), h('div', { class: 'inline-row' },
        select(options, s.activeProgram, (v) => { confirmDelete = false; save({ activeProgram: v }); }),
        btn('prog.new', () => { const id = newId(); save({ programs: [...structuredClone(progs), { id, name: t('prog.defaultName', { n: progs.length + 1 }), steps: [{ name: t('prog.defaultStep', { n: 1 }), sec: 60 }] }], activeProgram: id }); }, 'ghost', { disabled: progs.length >= 8 }),
        cur ? btn(confirmDelete ? 'prog.deleteSure' : 'prog.delete', () => { if (!confirmDelete) { confirmDelete = true; draw(); return; } confirmDelete = false; save({ programs: structuredClone(progs).filter((p) => p.id !== cur.id), activeProgram: '' }); }, 'ghost') : null)),
      row(t('prog.endLabel'), select([['loop', t('prog.endLoop')], ['free', t('prog.endFree')]], s.programEnd, (v) => save({ programEnd: v })), t('prog.endHint')),
      cur ? h('div', { class: 'field' }, h('label', { text: t('prog.name') }), h('input', { type: 'text', value: cur.name, maxLength: 60, onchange: (e) => edit((p) => { p.name = e.target.value.trim() || p.name; }) })) : null,
      cur ? stepsEditor(cur, edit) : h('p', { class: 'hint', text: t('prog.noneHint') })),
    card(t('col.title'),
      h('p', { class: 'hint', text: t('col.intro') }),
      row(t('lim.single'), h('div', { class: 'inline-row' },
        h('input', { type: 'number', min: 0, max: 600, step: 1, value: Math.floor(s.timer.limitSeconds / 60), title: t('prog.minutes'), 'aria-label': t('prog.minutes'), onchange: (e) => save({ timer: { limitSeconds: Math.max(0, Math.round(Number(e.target.value)) || 0) * 60 + (S().timer.limitSeconds % 60) } }) }),
        h('span', { class: 'mono', text: ':' }),
        h('input', { type: 'number', min: 0, max: 59, step: 1, value: s.timer.limitSeconds % 60, title: t('prog.seconds'), 'aria-label': t('prog.seconds'), onchange: (e) => save({ timer: { limitSeconds: Math.floor(S().timer.limitSeconds / 60) * 60 + Math.min(59, Math.max(0, Math.round(Number(e.target.value)) || 0)) } }) }),
        h('span', { class: 'hint inline', text: t('lim.minSec') })), t('lim.singleHint')),
      row(t('col.warnSec'), number(s.timer.warnSeconds, 0, 3600, 1, (n) => save({ timer: { warnSeconds: n } })), t('col.warnSecHint')),
      row(t('col.flashSec'), number(s.timer.flashSeconds, 0, 3600, 1, (n) => save({ timer: { flashSeconds: n } })), t('col.flashSecHint')),
      ...['normal', 'warn', 'over', 'idle'].map((k) => h('div', { class: 'color-row' },
        h('div', { text: t(`col.${k}`) }),
        h('input', { type: 'color', value: s.colors[k] || DEFAULT_HEX[k], title: t(`col.${k}`), onchange: (e) => save({ colors: { [k]: e.target.value } }) }),
        btn('col.default', () => save({ colors: { [k]: '' } }), 'ghost', { disabled: !s.colors[k] }),
        h('span', { class: 'swatch', text: '01:30', style: undefined, dataset: { k } }))),
      h('p', { class: 'hint', text: t('col.hint') }))
  );
  // swatches take their colour from the same variables as the figures (set through the style object, which the CSP allows)
  for (const sw of box.querySelectorAll('.swatch')) sw.style.color = s.colors[sw.dataset.k] || DEFAULT_HEX[sw.dataset.k];
  return box;
}

function stepsEditor(cur, edit) {
  const idx = GC.program.index();
  const wrap = h('div', { class: 'steps' });
  const msg = h('div', { class: 'hint', text: t('prog.stepsHint') });
  wrap.append(h('div', { class: 'step-row head' }, h('span'), h('span', { text: t('prog.stepName') }), h('span', { text: t('prog.minutes') }), h('span', { text: t('prog.seconds') }), h('span'), h('span'), h('span')));
  cur.steps.forEach((st, i) => {
    const mins = Math.floor(st.sec / 60);
    const secs = st.sec % 60;
    const setTime = (m, sec) => edit((p) => { p.steps[i].sec = Math.max(0, Math.min(36000, m * 60 + sec)); });
    wrap.append(h('div', { class: 'step-row' + (i === idx ? ' current' : '') },
      h('span', { class: 'idx', text: String(i + 1) }),
      h('input', { type: 'text', value: st.name, maxLength: 60, placeholder: t('prog.stepName'), 'aria-label': t('prog.stepName'), onchange: (e) => edit((p) => { p.steps[i].name = e.target.value.trim(); }) }),
      h('input', { type: 'number', min: 0, max: 600, step: 1, value: mins, title: t('prog.minutes'), 'aria-label': t('prog.minutes'), onchange: (e) => setTime(Math.max(0, Math.round(Number(e.target.value)) || 0), secs) }),
      h('input', { type: 'number', min: 0, max: 59, step: 1, value: secs, title: t('prog.seconds'), 'aria-label': t('prog.seconds'), onchange: (e) => setTime(mins, Math.min(59, Math.max(0, Math.round(Number(e.target.value)) || 0))) }),
      h('button', { class: 'btn ghost compact', type: 'button', text: '↑', title: t('prog.up'), disabled: i === 0, onclick: () => edit((p) => { [p.steps[i - 1], p.steps[i]] = [p.steps[i], p.steps[i - 1]]; }) }),
      h('button', { class: 'btn ghost compact', type: 'button', text: '↓', title: t('prog.down'), disabled: i === cur.steps.length - 1, onclick: () => edit((p) => { [p.steps[i + 1], p.steps[i]] = [p.steps[i], p.steps[i + 1]]; }) }),
      h('button', { class: 'btn ghost compact', type: 'button', text: '✕', title: t('prog.remove'), onclick: () => edit((p) => { p.steps.splice(i, 1); }) })));
  });
  wrap.append(
    h('div', { class: 'inline-actions' },
      btn('prog.addStep', () => edit((p) => { p.steps.push({ name: t('prog.defaultStep', { n: p.steps.length + 1 }), sec: 60 }); }), 'ghost', { disabled: cur.steps.length >= 40 }),
      btn('prog.prev', () => GC.action('prev', 'settings')), btn('prog.next', () => GC.action('next', 'settings')), btn('prog.restart', () => GC.action('restart', 'settings'))),
    msg);
  return wrap;
}

const BUILD = { general, programs: programsTab, signals, updates: updatesTab, backup: backupTab, about: aboutTab };

function draw() {
  const nav = $('tabs');
  nav.replaceChildren(...TABS.map((id) => h('button', { class: 'tab-btn' + (id === tab ? ' on' : ''), type: 'button', role: 'tab', 'aria-selected': id === tab, text: t(`sec.${id}`), onclick: () => { stopKeyCapture(); GC.signals.stopLearn(); learning = ''; tab = id; draw(); } })));
  const body = $('tabBody');
  const top = body.scrollTop;
  body.replaceChildren(...(notice ? [h('div', { class: 'msg ok', text: notice })] : []), BUILD[tab]());
  body.scrollTop = top;
  notice = '';
}

export function initSettings() {
  const open = () => { $('settings').hidden = false; draw(); GC.signals.listDevices(); };
  const close = () => { stopKeyCapture(); GC.signals.stopLearn(); learning = ''; $('settings').hidden = true; };
  $('btnSettings').addEventListener('click', open);
  $('btnCloseSettings').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('settings').hidden && !keyCapture) close(); });
  // called when MIDI messages arrive or the audio level changes while the panel is open
  GC.settingsUi = {
    open,
    refresh(levelOnly) {
      if ($('settings').hidden) return;
      if (levelOnly) return paintMeter();
      if ((tab === 'signals' || tab === 'programs') && !(document.activeElement && document.activeElement.matches?.('input, select'))) draw();
    }
  };
}
