// Posters page: choose a venue or a council and print an A4 poster in its top languages.
import { AREAS, SITES, VENUE_TYPES, fmt } from './model.js';
import { buildPoster } from './components.js';
import { PHRASES } from './phrases.js';
import { $, el } from './ui.js';

const select = $('#for');
const sorted = AREAS.map((a, j) => j).sort((x, y) => AREAS[x].name.localeCompare(AREAS[y].name));
const councils = el('optgroup', { label: 'A whole council' });
for (const j of sorted) councils.append(el('option', { value: `council=${AREAS[j].name}`, text: AREAS[j].name }));
select.append(councils);
for (const j of sorted) {
  const group = el('optgroup', { label: `Venues in ${AREAS[j].name}` });
  SITES.filter((s) => s.lga === AREAS[j].name).forEach((s) => group.append(el('option', { value: `site=${s.id}`, text: `${s.name} (${VENUE_TYPES[s.type].name.toLowerCase()})` })));
  if (group.children.length) select.append(group);
}

function fromHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  const m = h.match(/^site=(\d{1,2})$/);
  if (m && SITES[Number(m[1])]) return h;
  const c = h.match(/^council=(.+)$/);
  if (c && AREAS.some((a) => a.name === c[1])) return h;
  return `council=${[...AREAS].sort((a, b) => b.hidden - a.hidden)[0].name}`;
}

function draw() {
  const [kind, value] = select.value.split(/=(.*)/s);
  const site = kind === 'site' ? SITES[Number(value)] : null;
  const area = AREAS.find((a) => a.name === (site ? site.lga : value));
  const count = Number($('#count').value);
  $('#count-out').textContent = String(count);
  const { poster, languages } = buildPoster({ area, site, count });
  $('#stage').replaceChildren(poster);
  $('#langs').replaceChildren(...languages.map(({ name, speakers }) => el('li', {},
    el('span', {}, name, PHRASES[name] ? '' : el('span', { class: 'pill gold', text: 'needs translator' })),
    el('span', { class: 'mono muted', text: fmt(speakers) }))));
  history.replaceState(null, '', `#${encodeURIComponent(select.value).replace('%3D', '=')}`);
}

select.value = fromHash();
select.addEventListener('change', draw);
$('#count').addEventListener('input', draw);
$('#print').addEventListener('click', () => window.print());
window.addEventListener('hashchange', () => { select.value = fromHash(); draw(); });
draw();
