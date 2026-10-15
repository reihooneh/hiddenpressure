// Overview page: the 3D hero, the age chart, the mini map, the plan comparison and a sample poster.
import { AREAS, DEFAULTS, makePlan, fmt, round100 } from './model.js';
import { createMap, mapLegend } from './map.js';
import { ageChart, compareBars, planList, buildPoster } from './components.js';
import { $, $$ } from './ui.js';

const { plan, naive } = makePlan(DEFAULTS);

ageChart($('#age-chart'));
compareBars($('#home-compare'), plan, naive);
planList($('#home-plan'), plan.selected, plan.gains);

const top = [...AREAS].sort((a, b) => b.hidden - a.hidden)[0];
$('#home-poster').append(buildPoster({ area: top, count: 4 }).poster);

await document.fonts.ready;

const host = $('#home-map');
const map = createMap(host, { ariaLabel: 'Map of the 13 councils coloured by likely undiagnosed high blood pressure' });
const legendHost = document.createElement('div');
host.append(legendHost);
let mode = 'rate';
function draw() {
  const values = AREAS.map((a) => (mode === 'rate' ? a.rate : a.hidden));
  const text = (j) => (mode === 'rate' ? `${AREAS[j].rate.toFixed(0)} per 1,000` : fmt(round100(AREAS[j].hidden)));
  map.render({ view: 'region', values, valueText: text, selected: [], allowed: [], radius: 0 });
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  legendHost.replaceChildren(mapLegend(
    mode === 'rate' ? lo.toFixed(0) : fmt(round100(lo)),
    mode === 'rate' ? hi.toFixed(0) : fmt(round100(hi)),
    mode === 'rate' ? 'adults per 1,000 likely undiagnosed' : 'people likely undiagnosed',
  ));
}
$$('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  mode = b.dataset.mode;
  $$('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  draw();
}));
draw();

// The 3D model loads last so the rest of the page is ready first.
const { mountHero } = await import('./hero3d.js');
mountHero($('#hero'));
