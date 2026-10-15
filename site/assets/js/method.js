// Method page: the worked example, the reach curve, greedy vs best possible and the stress test,
// all computed from the same model the planner uses.
import { AREAS, BANDS, SITES, VENUE_TYPES, DEFAULTS, allowedSites, bestPossible, evaluate, greedy, makePlan, reachMatrix, stressTest, fmt, round100 } from './model.js';
import { $, el, sv } from './ui.js';

// ---------- worked example ----------
const pick = $('#worked-council');
AREAS.map((a, j) => j).sort((x, y) => AREAS[x].name.localeCompare(AREAS[y].name))
  .forEach((j) => pick.append(el('option', { value: j, text: AREAS[j].name })));
pick.value = String(AREAS.findIndex((a) => a.name === 'Fairfield'));
function worked() {
  const a = AREAS[Number(pick.value)];
  const row = (cells, cls) => el('div', { class: `w-row ${cls || ''}`, role: 'row' }, ...cells.map((c, i) => el('span', { role: i ? 'cell' : 'rowheader', text: c })));
  $('#worked').replaceChildren(
    row(['Age', 'Adults', 'Measure high', "Didn't report", 'Likely undiagnosed'], 'head'),
    ...a.byBand.map((b, i) => row([BANDS[i].label, fmt(b.adults), `${Number(BANDS[i].measured.toFixed(2))}%`, `${BANDS[i].unreported}%`, fmt(b.hidden)])),
    row(['Total', fmt(a.adults), `${((a.high / a.adults) * 100).toFixed(1)}%`, `${((a.hidden / a.high) * 100).toFixed(1)}%`, fmt(a.hidden)], 'total'),
  );
}
pick.addEventListener('change', worked);
worked();

// ---------- reach curve ----------
// Fixed layout: plot area inside generous margins, axis labels outside it, legend in HTML below.
(function decay() {
  const W = 520; const H = 300; const m = { l: 52, r: 16, t: 16, b: 44 };
  const R = 6; const maxKm = 15; const maxP = 0.25;
  const x = (d) => m.l + (d / maxKm) * (W - m.l - m.r);
  const y = (p) => H - m.b - (p / maxP) * (H - m.t - m.b);
  const svg = sv('svg', { class: 'chart-svg', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Reach falls with distance for each venue type; at 6 km it is about 37% of the base' });
  for (const p of [0, 0.05, 0.1, 0.15, 0.2, 0.25]) {
    svg.append(sv('line', { class: p ? 'grid' : 'axis', x1: m.l, x2: W - m.r, y1: y(p), y2: y(p) }),
      sv('text', { x: m.l - 8, y: y(p) + 4, 'text-anchor': 'end', text: `${Math.round(p * 100)}%` }));
  }
  for (const d of [0, 3, 6, 9, 12, 15]) svg.append(sv('text', { x: x(d), y: H - m.b + 18, 'text-anchor': 'middle', text: `${d}` }));
  svg.append(sv('text', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle', text: 'Distance from the venue (km)' }));
  svg.append(sv('line', { class: 'marker', x1: x(R), x2: x(R), y1: m.t, y2: H - m.b }),
    sv('text', { class: 'marker-text', x: x(R) + 6, y: m.t + 12, text: 'R = 6 km: 37% of base' }));
  for (const [type, v] of Object.entries(VENUE_TYPES)) {
    let d = '';
    for (let k = 0; k <= 60; k++) {
      const km = (k / 60) * maxKm;
      d += `${k ? 'L' : 'M'}${x(km).toFixed(1)} ${y(v.reach * Math.exp(-((km / R) ** 2))).toFixed(1)}`;
    }
    svg.append(sv('path', { class: `curve ${type}`, d }));
  }
  $('#decay').append(svg);
  const key = { station: 'key', shopping: 'key', library: 'key teal' };
  $('#decay-legend').replaceChildren(...Object.entries(VENUE_TYPES).map(([type, v]) => {
    const k = el('i', { class: key[type] });
    if (type === 'station') k.classList.add('ink');
    return el('span', {}, k, `${v.plural}: ${Math.round(v.reach * 100)}% at the venue`);
  }));
})();

// ---------- greedy vs best ----------
function greedyTable() {
  const allowed = allowedSites(DEFAULTS.types);
  const P = reachMatrix(DEFAULTS.radius);
  const choose = (n, k) => { let c = 1; for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1); return c; };
  const rows = [];
  for (let k = 1; k <= 4; k++) {
    const g = evaluate(greedy(k, allowed, P).selected, P).reach;
    const b = bestPossible(k, allowed, P).reach;
    rows.push(el('tr', {},
      el('td', { text: String(k) }), el('td', { class: 'r num', text: fmt(choose(allowed.length, k)) }),
      el('td', { class: 'r num', text: fmt(round100(g)) }), el('td', { class: 'r num', text: fmt(round100(b)) }),
      el('td', { class: `r num ${g / b > 0.995 ? 'ok' : 'warn'}`, text: `${((g / b) * 100).toFixed(1)}%` })));
  }
  $('#greedy-table tbody').replaceChildren(...rows);
}

// ---------- stress test ----------
function stress() {
  const { plan } = makePlan(DEFAULTS);
  const freq = stressTest(DEFAULTS);
  const chosen = new Set(plan.selected);
  const host = $('#method-stress');
  const rows = [...freq].sort((a, b) => b[1] - a[1]).slice(0, 11);
  host.replaceChildren(...rows.map(([i, f]) => {
    const fill = el('span', { class: `fill ${chosen.has(i) ? 'teal' : 'slate'}` });
    fill.style.width = `${f * 100}%`;
    return el('div', { class: 'stab-row' },
      el('span', { class: 'name', title: SITES[i].name, text: `${chosen.has(i) ? '● ' : '○ '}${SITES[i].name}` }),
      el('span', { class: 'track' }, fill),
      el('span', { class: 'pct', text: `${(f * 100).toFixed(0)}%` }));
  }), el('p', { class: 'small muted', text: '● in the plan · ○ an alternative · share of 300 runs that chose it' }));
}

// The heavier checks run after the page has painted.
const later = window.requestIdleCallback || ((fn) => setTimeout(fn, 50));
later(() => { greedyTable(); stress(); });
