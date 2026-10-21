// The list of the last speeches of this session (src/speeches.js keeps them in memory only).
import { createSpeechLog, toCsv, stampText } from '../../src/speeches.js';
import { formatDuration } from '../../src/trigger/stopwatch.js';

const GC = window.GC;
const { $, h } = GC;
const log = createSpeechLog();

function say(key, ok) {
  const m = $('speechesMsg');
  m.className = ok ? 'msg ok' : 'msg err';
  m.textContent = key ? GC.t(key) : '';
}

function render() {
  const rows = log.list();
  const body = $('speechesBody');
  $('btnSpeechesCopy').disabled = $('btnSpeechesSave').disabled = $('btnSpeechesClear').disabled = !rows.length;
  if (!rows.length) {
    body.replaceChildren(h('p', { class: 'hint', text: GC.t('sp.empty') }));
    return;
  }
  const time = GC.dtf(GC.state.locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  body.replaceChildren(h('table', { class: 'sp-table' },
    h('thead', {}, h('tr', {}, ...['sp.colTime', 'sp.colStep', 'sp.colDuration', 'sp.colLimit'].map((k) => h('th', { text: GC.t(k) })))),
    h('tbody', {}, ...rows.map((e) => h('tr', {},
      h('td', { text: time.format(e.at) }),
      h('td', { text: [e.program, e.step].filter(Boolean).join(' · ') }),
      h('td', { class: `num${e.limitSec > 0 && e.ms > e.limitSec * 1000 ? ' over' : ''}`, text: formatDuration(e.ms) }),
      h('td', { class: 'num', text: e.limitSec > 0 ? formatDuration(e.limitSec * 1000) : GC.t('sp.noLimit') }))))));
}

function close() {
  $('speeches').hidden = true;
  document.removeEventListener('keydown', onKey, true);
}
function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); close(); }
}

GC.speeches = {
  // entry: { ms, program, step, limitSec } for a speech that has just ended
  record(entry) { log.add({ ...entry, at: Date.now() }); if (!$('speeches').hidden) render(); },
  open() {
    say('', true);
    render();
    $('speeches').hidden = false;
    document.addEventListener('keydown', onKey, true);
    $('btnCloseSpeeches').focus();
  }
};

$('btnCloseSpeeches').addEventListener('click', close);
$('speeches').addEventListener('click', (e) => { if (e.target === $('speeches')) close(); });
$('btnSpeechesClear').addEventListener('click', () => { log.clear(); say('', true); render(); });
$('btnSpeechesCopy').addEventListener('click', async () => {
  const res = await window.api.clipboard.write(toCsv(log.list()));
  say(res.ok ? 'sp.copied' : 'sp.saveFailed', res.ok);
});
$('btnSpeechesSave').addEventListener('click', async () => {
  const res = await window.api.speeches.saveCsv(toCsv(log.list()));
  if (res.canceled) return say('', true);
  say(res.ok ? 'sp.saved' : 'sp.saveFailed', res.ok);
});
