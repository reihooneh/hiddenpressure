// Councils page: a profile for the chosen council, its place on the map and a sortable table.
import { AREAS, BANDS, SITES, VENUE_TYPES, MOST_DISADVANTAGED, fmt, round100 } from './model.js';
import { createMap } from './map.js';
import { $, $$, el, heatStep, setBar } from './ui.js';

const byName = (name) => AREAS.findIndex((a) => a.name === name);
const fromHash = () => {
  const j = byName(decodeURIComponent(location.hash.slice(1)));
  return j >= 0 ? j : AREAS.reduce((b, a, j) => (a.hidden > AREAS[b].hidden ? j : b), 0);
};
let current = fromHash();
let view = 'region';
let sort = { key: 'hidden', dir: -1 };
const rates = AREAS.map((a) => a.rate);
const rlo = Math.min(...rates);
const rhi = Math.max(...rates);

const chips = $('#chips');
AREAS.map((a, j) => j).sort((x, y) => AREAS[x].name.localeCompare(AREAS[y].name)).forEach((j) => {
  chips.append(el('button', { class: 'chip', type: 'button', 'data-j': j, 'aria-pressed': 'false', text: AREAS[j].name, onclick: () => choose(j) }));
});

function profile() {
  const a = AREAS[current];
  const host = $('#profile');
  const rank = [...AREAS].sort((x, y) => y.rate - x.rate).findIndex((x) => x.name === a.name) + 1;
  const venues = SITES.filter((s) => s.lga === a.name);
  const maxBand = Math.max(...a.byBand.map((b) => b.hidden));
  const bands = el('div', { class: 'bars' });
  a.byBand.forEach((b, i) => {
    const f = el('span', { class: 'fill' });
    bands.append(el('span', { class: 'bar-label mono', text: BANDS[i].label }), el('span', { class: 'track' }, f), el('span', { class: 'bar-value', text: fmt(round100(b.hidden)) }));
    setBar(f, b.hidden / maxBand);
  });
  const maxLang = a.langs[0][1];
  const langs = el('div', { class: 'bars' });
  a.langs.forEach(([name, n]) => {
    const f = el('span', { class: 'fill teal' });
    langs.append(el('span', { class: 'bar-label', text: name }), el('span', { class: 'track' }, f), el('span', { class: 'bar-value', text: fmt(n) }));
    setBar(f, n / maxLang);
  });
  // SEIFA IRSD: the national average is 1,000; these councils run from about 800 to 1,100.
  const mark = el('span', { class: 'seifa-mark' });
  mark.style.left = `${Math.max(0, Math.min(100, ((a.irsd - 800) / 320) * 100))}%`;
  host.replaceChildren(
    el('div', { class: 'profile-head' },
      el('div', {}, el('p', { class: 'eyebrow', text: 'Council profile' }), el('h2', { text: a.name })),
      a.irsd < MOST_DISADVANTAGED ? el('span', { class: 'pill red', text: 'Among the most disadvantaged' }) : el('span', { class: 'pill', text: `Rate rank ${rank} of ${AREAS.length}` })),
    el('div', { class: 'mini-stats' },
      el('div', {}, el('b', { text: fmt(round100(a.hidden)) }), el('span', { text: 'likely undiagnosed' })),
      el('div', {}, el('b', { text: a.rate.toFixed(0) }), el('span', { text: 'per 1,000 adults' })),
      el('div', {}, el('b', { text: fmt(a.adults) }), el('span', { text: 'adults (18+)' }))),
    el('div', {}, el('h4', { text: 'Likely undiagnosed by age' }),
      el('p', { class: 'small muted', text: 'Younger adults are fewer per head but far less likely to know, so they add up.' }), bands),
    el('div', {}, el('h4', { text: 'Languages spoken at home (after English)' }),
      el('p', { class: 'small muted', text: 'People who speak each language at home, Census 2021.' }), langs),
    el('div', { class: 'seifa' }, el('h4', { text: `Disadvantage: SEIFA ${a.irsd.toFixed(0)}` }),
      el('div', { class: 'seifa-scale', role: 'img', 'aria-label': `SEIFA score ${a.irsd.toFixed(0)}; the national average is 1,000` }, mark),
      el('div', { class: 'seifa-ends' }, el('span', { text: 'More disadvantaged (800)' }), el('span', { text: 'Average 1,000' }), el('span', { text: 'Less (1,120)' }))),
    el('div', {}, el('h4', { text: `Venues in the planner (${venues.length})` }),
      el('p', { class: 'small muted', text: venues.map((s) => `${s.name} (${VENUE_TYPES[s.type].name.toLowerCase()})`).join(' · ') || 'None' })),
    el('div', { class: 'btn-row' },
      el('a', { class: 'btn small', href: `posters.html#council=${encodeURIComponent(a.name)}`, text: 'Make a poster for this council' }),
      el('a', { class: 'btn ghost small', href: 'planner.html', text: 'Open the planner' })),
  );
}

await document.fonts.ready;
const map = createMap($('#council-map'), { ariaLabel: 'Map with the chosen council highlighted', onArea: (j) => choose(j), focus: true });
function drawMap() {
  map.render({
    view, values: rates, valueText: (j) => `${AREAS[j].rate.toFixed(0)} per 1,000`,
    selected: [], allowed: [], radius: 0, activeArea: current,
  });
}

function table() {
  const tbody = $('#table tbody');
  const rows = AREAS.map((a, j) => ({ ...a, j }));
  rows.sort((x, y) => (typeof x[sort.key] === 'string' ? x[sort.key].localeCompare(y[sort.key]) : x[sort.key] - y[sort.key]) * sort.dir);
  tbody.replaceChildren(...rows.map((r) => {
    const tr = el('tr', { tabindex: 0, class: r.j === current ? 'active' : null, 'aria-selected': String(r.j === current) },
      el('th', { scope: 'row' }, el('span', { class: `swatch bg-heat-${heatStep(r.rate, rlo, rhi)}`, 'aria-hidden': 'true' }), r.name),
      el('td', { class: 'r num', text: fmt(r.adults) }),
      el('td', { class: 'r num', text: fmt(round100(r.hidden)) }),
      el('td', { class: 'r num', text: r.rate.toFixed(0) }),
      el('td', { class: 'r num', text: r.irsd.toFixed(0) }),
      el('td', { text: r.langs.slice(0, 4).map((l) => l[0]).join(', ') }));
    tr.addEventListener('click', () => choose(r.j, true));
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') choose(r.j, true); });
    return tr;
  }));
  $$('#table th[data-key]').forEach((th) => th.setAttribute('aria-sort', th.dataset.key === sort.key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'));
}
$$('#table th[data-key] button').forEach((b) => b.addEventListener('click', () => {
  const key = b.parentElement.dataset.key;
  sort = { key, dir: sort.key === key ? -sort.dir : key === 'name' ? 1 : -1 };
  table();
}));
$$('[data-view]').forEach((b) => b.addEventListener('click', () => {
  view = b.dataset.view;
  $$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  drawMap();
}));

function choose(j, scroll = false) {
  current = j;
  history.replaceState(null, '', `#${encodeURIComponent(AREAS[j].name)}`);
  $$('#chips .chip').forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.j) === j)));
  profile();
  drawMap();
  table();
  if (scroll) $('#profile').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.addEventListener('hashchange', () => { const j = fromHash(); if (j !== current) choose(j); });
choose(current);
