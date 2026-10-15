// Planner page: settings → greedy plan → map, list, comparison, details and the stress test.
// Settings live in the URL (#n=8&r=6&p=0&t=ssl) so a plan can be shared as a link.
import { AREAS, SITES, TOTALS, VENUE_TYPES, DEFAULTS, MOST_DISADVANTAGED, makePlan, stressTest, fmt, round100 } from './model.js';
import { createMap, mapLegend } from './map.js';
import { compareBars, planList } from './components.js';
import { $, $$, el, toast } from './ui.js';

const PRIORITY = ['Off', 'Some', 'Strong', 'Strongest'];
const TYPE_KEYS = ['shopping', 'station', 'library'];

function readHash() {
  const s = structuredClone(DEFAULTS);
  const q = new URLSearchParams(location.hash.slice(1));
  const int = (k, lo, hi, d) => {
    const v = Number(q.get(k));
    return q.has(k) && Number.isInteger(v) && v >= lo && v <= hi ? v : d;
  };
  s.stations = int('n', 1, 15, s.stations);
  s.radius = int('r', 2, 12, s.radius);
  s.priority = int('p', 0, 3, s.priority);
  const t = q.get('t');
  if (t && /^[01]{3}$/.test(t) && t !== '000') TYPE_KEYS.forEach((k, i) => { s.types[k] = t[i] === '1'; });
  return s;
}
function writeHash(s) {
  const t = TYPE_KEYS.map((k) => (s.types[k] ? '1' : '0')).join('');
  const hash = `n=${s.stations}&r=${s.radius}&p=${s.priority}&t=${t}`;
  history.replaceState(null, '', `#${hash}`);
}

const ui = {
  stations: $('#stations'), radius: $('#radius'), priority: $('#priority'),
  stationsOut: $('#stations-out'), radiusOut: $('#radius-out'), priorityOut: $('#priority-out'),
  types: $$('#types input'),
};
let settings = readHash();
let view = 'urban';
let colour = 'reached';
let active = null; // { kind: 'site' | 'area', id }
let result = null;

function syncControls() {
  ui.stations.value = settings.stations;
  ui.radius.value = settings.radius;
  ui.priority.value = settings.priority;
  ui.types.forEach((c) => { c.checked = settings.types[c.value]; });
  ui.stationsOut.textContent = String(settings.stations);
  ui.radiusOut.textContent = `${settings.radius} km`;
  ui.priorityOut.textContent = PRIORITY[settings.priority];
}

await document.fonts.ready;
const map = createMap($('#planner-map'), {
  ariaLabel: 'Map of the chosen check stations and the share of each council they reach',
  onArea: (j) => select({ kind: 'area', id: j }),
  onSite: (i) => select({ kind: 'site', id: i }),
});

function select(next) {
  active = active && next && active.kind === next.kind && active.id === next.id ? null : next;
  drawMap();
  drawPlan();
  drawDetail();
}

function update() {
  syncControls();
  writeHash(settings);
  result = makePlan(settings);
  if (active?.kind === 'site' && !result.plan.selected.includes(active.id)) active = null;
  drawMap();
  drawSummary();
  drawPlan();
  drawDetail();
  $('#stability').replaceChildren();
}

function drawMap() {
  const cov = result.plan.coverage;
  const values = AREAS.map((a, j) => (colour === 'reached' ? cov[j] : colour === 'rate' ? a.rate : a.hidden));
  const text = (j) => (colour === 'reached' ? `${(cov[j] * 100).toFixed(0)}% reached`
    : colour === 'rate' ? `${AREAS[j].rate.toFixed(0)} per 1,000` : fmt(round100(AREAS[j].hidden)));
  map.render({
    view, values, valueText: text, palette: colour === 'reached' ? 'cool' : 'heat',
    selected: result.plan.selected, allowed: result.allowed, radius: settings.radius,
    activeArea: active?.kind === 'area' ? active.id : null,
    activeSite: active?.kind === 'site' ? active.id : null,
  });
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const f = (v) => (colour === 'reached' ? `${(v * 100).toFixed(0)}%` : colour === 'rate' ? v.toFixed(0) : fmt(round100(v)));
  const unit = colour === 'reached' ? 'of likely undiagnosed reached' : colour === 'rate' ? 'per 1,000 adults likely undiagnosed' : 'people likely undiagnosed';
  $('#planner-legend').replaceChildren(...mapLegend(f(lo), f(hi), unit, [
    el('span', {}, el('i', { class: 'key ring' }), ` ${settings.radius} km travel ring`),
    el('span', {}, el('i', { class: 'key dot' }), ' Other venues'),
  ], colour === 'reached' ? 'cool' : 'heat').childNodes);
}

function drawSummary() {
  const { plan, naive } = result;
  $('#reach-number').textContent = fmt(round100(plan.reach));
  $('#reach-sub').textContent = `of ${fmt(Math.round(TOTALS.hidden / 1000) * 1000)} likely undiagnosed (${((plan.reach / TOTALS.hidden) * 100).toFixed(1)}%)`;
  compareBars($('#compare'), plan, naive);
  const disHidden = AREAS.filter((a) => a.irsd < MOST_DISADVANTAGED).reduce((s, a) => s + a.hidden, 0);
  $('#summary-kv').replaceChildren(
    el('dt', { text: 'Reached in the most disadvantaged councils' }),
    el('dd', { text: `${((plan.disadvantaged / disHidden) * 100).toFixed(1)}%` }),
    el('dt', { text: 'Councils with any station nearby (>10%)' }),
    el('dd', { text: `${plan.coverage.filter((c) => c > 0.1).length} of ${AREAS.length}` }),
  );
}

function drawPlan() {
  planList($('#plan'), result.plan.selected, result.plan.gains, {
    active: active?.kind === 'site' ? active.id : null,
    onPick: (i) => select({ kind: 'site', id: i }),
  });
}

function drawDetail() {
  const host = $('#detail');
  host.replaceChildren();
  if (!active) {
    host.append(el('p', { class: 'small muted', text: 'Select a station or a council on the map or in the list for details.' }));
    return;
  }
  if (active.kind === 'site') {
    const s = SITES[active.id];
    const row = result.P[active.id];
    const alone = AREAS.map((a, j) => ({ name: a.name, people: row[j] * a.hidden, share: row[j] }))
      .sort((x, y) => y.people - x.people).slice(0, 3);
    host.append(
      el('h4', { text: s.name }),
      el('p', { class: 'small muted', text: `${VENUE_TYPES[s.type].name} in ${s.lga}. Best time: ${VENUE_TYPES[s.type].when}.` }),
      el('dl', { class: 'kv' }, ...alone.flatMap((a) => [el('dt', { text: a.name }), el('dd', { text: `${fmt(round100(a.people))} (${(a.share * 100).toFixed(0)}%)` })])),
      el('p', { class: 'small' }, el('a', { href: `posters.html#site=${active.id}`, text: 'Make this venue\'s poster →' })),
    );
  } else {
    const a = AREAS[active.id];
    host.append(
      el('h4', { text: a.name }),
      el('dl', { class: 'kv' },
        el('dt', { text: 'Likely undiagnosed' }), el('dd', { text: fmt(round100(a.hidden)) }),
        el('dt', { text: 'Reached by this plan' }), el('dd', { text: `${(result.plan.coverage[active.id] * 100).toFixed(1)}%` }),
        el('dt', { text: 'SEIFA disadvantage score' }), el('dd', { text: a.irsd.toFixed(0) }),
        el('dt', { text: 'Top languages' }), el('dd', { text: a.langs.slice(0, 3).map((l) => l[0]).join(', ') })),
      el('p', { class: 'small' }, el('a', { href: `councils.html#${encodeURIComponent(a.name)}`, text: `${a.name} profile →` })),
    );
  }
}

// ---------- events ----------
ui.stations.addEventListener('input', () => { settings.stations = Number(ui.stations.value); update(); });
ui.radius.addEventListener('input', () => { settings.radius = Number(ui.radius.value); update(); });
ui.priority.addEventListener('input', () => { settings.priority = Number(ui.priority.value); update(); });
ui.types.forEach((c) => c.addEventListener('change', () => {
  const next = { ...settings.types, [c.value]: c.checked };
  if (!Object.values(next).some(Boolean)) {
    c.checked = true;
    toast('Keep at least one venue type');
    return;
  }
  settings.types = next;
  update();
}));
$$('[data-view]').forEach((b) => b.addEventListener('click', () => {
  view = b.dataset.view;
  $$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  drawMap();
}));
$$('[data-colour]').forEach((b) => b.addEventListener('click', () => {
  colour = b.dataset.colour;
  $$('[data-colour]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  drawMap();
}));
$('#reset').addEventListener('click', () => { settings = structuredClone(DEFAULTS); active = null; update(); });
$('#copy-link').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    toast('Link copied');
  } catch {
    toast('Copy the address bar to share this plan');
  }
});
$('#csv').addEventListener('click', () => {
  // Cells are quoted, and any that start like a formula are prefixed so spreadsheets show them as text.
  const cell = (v) => {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = [['Order', 'Venue', 'Type', 'Council', 'Latitude', 'Longitude', 'Extra people reached', 'Best time']];
  result.plan.selected.forEach((i, k) => {
    const s = SITES[i];
    rows.push([k + 1, s.name, VENUE_TYPES[s.type].name, s.lga, s.lat, s.lon, Math.round(result.plan.gains[k]), VENUE_TYPES[s.type].when]);
  });
  const blob = new Blob([`﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `hiddenpressure-plan-${settings.stations}-stations.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('#stress').addEventListener('click', () => {
  const btn = $('#stress');
  btn.disabled = true;
  btn.textContent = 'Running…';
  setTimeout(() => {
    const freq = stressTest(settings);
    const chosen = new Set(result.plan.selected);
    const rows = [...freq].sort((a, b) => b[1] - a[1]).slice(0, Math.max(settings.stations + 3, 8));
    const host = $('#stability');
    host.replaceChildren(...rows.map(([i, f]) => {
      const fill = el('span', { class: `fill ${chosen.has(i) ? 'teal' : 'slate'}` });
      fill.style.width = `${f * 100}%`;
      return el('div', { class: 'stab-row' },
        el('span', { class: 'name', title: SITES[i].name, text: `${chosen.has(i) ? '● ' : '○ '}${SITES[i].name}` }),
        el('span', { class: 'track' }, fill),
        el('span', { class: 'pct', text: `${(f * 100).toFixed(0)}%` }));
    }), el('p', { class: 'small muted', text: '● in your plan · ○ a close alternative. Above 80%: a safe pick.' }));
    btn.disabled = false;
    btn.textContent = 'Run it again';
  }, 30);
});
window.addEventListener('hashchange', () => { settings = readHash(); update(); });

update();
