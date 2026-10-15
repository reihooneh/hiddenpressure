// Pieces used on more than one page: the age chart, plan comparison bars, the plan list and posters.
import { AREAS, BANDS, SITES, VENUE_TYPES, fmt, round100 } from './model.js';
import { PHRASES, NEEDS_TRANSLATOR } from './phrases.js';
import { el, sv, setBar } from './ui.js';

const pct = (v) => String(Number(v.toFixed(1)));

export function ageChart(host) {
  host.replaceChildren();
  const max = 50; // percent: the scale for every bar
  for (const b of BANDS) {
    const knew = b.measured * (1 - b.unreported / 100);
    const hidden = b.measured - knew;
    const known = el('span', { class: 'fill known stack' });
    const hid = el('span', { class: 'fill hidden stack' });
    const track = el('div', { class: 'track', role: 'img', 'aria-label': `${b.label}: ${b.measured}% measured high, ${b.unreported}% of them didn't report it` }, known, hid);
    host.append(el('div', { class: 'age-row' },
      el('span', { class: 'age', text: b.label }),
      track,
      el('span', { class: 'val' }, el('b', { text: `${pct(b.measured)}%` }), ` · ${pct(b.unreported)}%`)));
    // The full bar (soft) is everyone who measured high; the red part drawn over its start didn't know.
    setBar(hid, hidden / max);
    setBar(known, b.measured / max);
  }
  host.append(el('p', { class: 'small muted', text: 'Numbers: share who measured high · share of them who didn\'t report it. Scale 0–50%.' }));
}

export function compareBars(host, plan, naive) {
  host.replaceChildren();
  const max = Math.max(plan.reach, naive.reach) * 1.05;
  const row = (label, value, cls) => {
    const f = el('span', { class: `fill ${cls}` });
    const r = el('div', { class: 'row' },
      el('div', { class: 'row-head' }, el('span', { text: label }), el('b', { text: fmt(round100(value)) })),
      el('div', { class: 'track tall' }, f));
    setBar(f, value / max);
    return r;
  };
  const gain = ((plan.reach - naive.reach) / naive.reach) * 100;
  host.append(
    row('Planner (greedy coverage)', plan.reach, 'teal'),
    row('Obvious plan (biggest councils first)', naive.reach, 'slate'),
    el('p', { class: 'small muted', text: `${gain >= 0 ? '+' : ''}${gain.toFixed(0)}% people reached, ${fmt(round100(plan.reach - naive.reach))} more, with the same number of stations.` }),
  );
}

export function planList(host, selected, gains, { active = null, onPick = null } = {}) {
  host.replaceChildren();
  selected.forEach((i, k) => {
    const s = SITES[i];
    const li = el('li', {
      class: `plan-item${active === i ? ' active' : ''}`,
      tabindex: onPick ? 0 : null,
      'data-site': i,
    },
    el('span', { class: 'badge', text: k + 1 }),
    el('span', { class: 'what' }, el('b', { text: s.name }), el('span', { text: `${VENUE_TYPES[s.type].name} · ${s.lga}` })),
    el('span', { class: 'gain' }, `+${fmt(round100(gains[k]))}`, el('small', { text: 'people' })));
    if (onPick) {
      li.addEventListener('click', () => onPick(i));
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(i); } });
    }
    host.append(li);
  });
}

// The poster: English headline, then the top languages for the council, then where and when.
export function buildPoster({ area, site = null, count = 5, english = true }) {
  const languages = area.langs.slice(0, count).map(([name, speakers]) => ({ name, speakers }));
  const lines = el('div', { class: 'poster-lines' });
  for (const { name } of languages) {
    const p = PHRASES[name];
    if (p) {
      lines.append(el('div', { class: 'poster-line', lang: p.lang, dir: p.dir || 'ltr' },
        el('b', { text: p.title }), el('span', { text: p.sub }),
        el('small', { lang: 'en', dir: 'ltr', text: `${name} · draft, check with a native speaker` })));
    } else {
      lines.append(el('div', { class: 'poster-line missing' },
        el('b', { text: name }), el('span', { text: NEEDS_TRANSLATOR[name] || 'Needs a community translator.' }),
        el('small', { text: 'Space kept for a checked translation' })));
    }
  }
  const where = site ? site.name : `Venues across ${area.name}`;
  const when = site ? VENUE_TYPES[site.type].when : 'See the planner for times at each venue';
  const heart = sv('svg', { class: 'heart', viewBox: '0 0 32 32', 'aria-hidden': 'true' },
    sv('circle', { cx: 16, cy: 16, r: 15, fill: '#c4372c' }),
    sv('path', { d: 'M5 17h6l2.5-6 4 11 3-8 1.8 3H27', fill: 'none', stroke: '#fff', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  const poster = el('article', { class: 'poster', lang: 'en', 'aria-label': `Poster for ${where}` },
    el('header', { class: 'poster-top' },
      el('span', { class: 'kicker', text: 'Community health check' }),
      el('h2', { text: english ? 'Free blood pressure check' : (PHRASES[languages[0]?.name]?.title || 'Free blood pressure check') }),
      el('p', { text: '5 minutes · No appointment needed' })),
    lines,
    el('footer', { class: 'poster-foot' },
      el('div', {}, el('b', { text: where }), el('span', { text: when })),
      heart));
  return { poster, languages };
}

export const areaByName = (name) => AREAS.find((a) => a.name === name);
