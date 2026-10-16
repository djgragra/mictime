'use strict';

// Shared helpers. Every classic script hangs its public part on the GC namespace.
window.GC = window.GC || {};

GC.$ = (id) => document.getElementById(id);

// h('div', { class: 'x', text: 'y', onclick: fn }, child, child…). Text always goes in through textContent, never as HTML.
GC.h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
};

const cache = new Map();
GC.dtf = (locale, options) => {
  const key = locale + JSON.stringify(options);
  if (!cache.has(key)) cache.set(key, new Intl.DateTimeFormat(locale, options));
  return cache.get(key);
};

GC.state = { settings: null, lang: 'en', locale: 'en', platform: '', keyStatus: { global: {}, failed: [] } };
