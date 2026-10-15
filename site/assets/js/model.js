// The HiddenPressure model: estimates, reach, the optimiser and the stress test.
// Pure functions with no DOM access, shared by every page and by the Node tests.
import { DATA } from './data.js';

export const BANDS = DATA.bands.map(([label, measured, unreported]) => ({ label, measured, unreported }));

// Undiagnosed = adults in each age band × share with high blood pressure when measured
//               × share of those who didn't report having it.
export const AREAS = DATA.areas.map((a, index) => {
  const byBand = a.bands.map((adults, i) => {
    const high = (adults * BANDS[i].measured) / 100;
    return { adults, high, hidden: (high * BANDS[i].unreported) / 100 };
  });
  const high = byBand.reduce((s, b) => s + b.high, 0);
  const hidden = byBand.reduce((s, b) => s + b.hidden, 0);
  return { ...a, index, byBand, high, hidden, rate: (hidden / a.adults) * 1000 };
});

export const TOTALS = {
  adults: AREAS.reduce((s, a) => s + a.adults, 0),
  high: AREAS.reduce((s, a) => s + a.high, 0),
  hidden: AREAS.reduce((s, a) => s + a.hidden, 0),
};

export const VENUE_TYPES = {
  station: { name: 'Train station', plural: 'Train stations', reach: 0.18, when: 'Weekdays 7–9 am and 4–7 pm, as commuters pass through' },
  shopping: { name: 'Shopping centre', plural: 'Shopping centres', reach: 0.22, when: 'Thursday late-night shopping and Saturday 10 am–2 pm' },
  library: { name: 'Library', plural: 'Libraries', reach: 0.07, when: 'Weekday mornings, popular with seniors and parents' },
};

export const SITES = DATA.sites.map((s, id) => ({ ...s, id }));

// Distance in km on a local flat projection (fine at this scale: errors under 0.5%).
export function km(a, b) {
  const dx = (a.lon - b.lon) * 111.32 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const dy = (a.lat - b.lat) * 110.57;
  return Math.hypot(dx, dy);
}
export const DIST = SITES.map((s) => AREAS.map((a) => km(s, a)));

// Chance that a station reaches someone with undiagnosed high blood pressure in a council:
// the venue type's reach, fading with distance as a bell curve of width R km.
export function reachMatrix(R, typeMultiplier = null) {
  return SITES.map((s, i) =>
    AREAS.map((_, j) => VENUE_TYPES[s.type].reach * (typeMultiplier ? typeMultiplier[s.type] : 1) * Math.exp(-((DIST[i][j] / R) ** 2))),
  );
}

export const MOST_DISADVANTAGED = 950; // SEIFA IRSD below this: the councils the priority targets

// Share of each council reached by at least one station: 1 − Π(1 − p). Overlaps aren't double counted.
export function evaluate(selected, P, hidden = AREAS.map((a) => a.hidden)) {
  const coverage = AREAS.map((_, j) => 1 - selected.reduce((q, i) => q * (1 - P[i][j]), 1));
  let reach = 0;
  let disadvantaged = 0;
  coverage.forEach((c, j) => {
    reach += c * hidden[j];
    if (AREAS[j].irsd < MOST_DISADVANTAGED) disadvantaged += c * hidden[j];
  });
  return { coverage, reach, disadvantaged };
}

// Weight of each council for the disadvantage priority: 1 + priority × (1000 − SEIFA) / 100, at least 1.
export function weights(priority) {
  return AREAS.map((a) => 1 + priority * Math.max(0, (1000 - a.irsd) / 100));
}

// Greedy maximum coverage: add the venue that reaches the most extra (weighted) people.
export function greedy(n, allowed, P, hidden = AREAS.map((a) => a.hidden), w = AREAS.map(() => 1)) {
  const selected = [];
  const gains = [];
  const missed = AREAS.map(() => 1);
  for (let k = 0; k < n; k++) {
    let best = -1;
    let bestValue = -1;
    for (const i of allowed) {
      if (selected.includes(i)) continue;
      let value = 0;
      for (let j = 0; j < AREAS.length; j++) value += w[j] * hidden[j] * missed[j] * P[i][j];
      if (value > bestValue) {
        bestValue = value;
        best = i;
      }
    }
    if (best < 0) break;
    let gain = 0;
    for (let j = 0; j < AREAS.length; j++) {
      gain += hidden[j] * missed[j] * P[best][j];
      missed[j] *= 1 - P[best][j];
    }
    selected.push(best);
    gains.push(gain);
  }
  return { selected, gains };
}

// The plan a busy planner might make without a model: the biggest councils first, one venue
// each (shopping centre, then station, then library), then round again.
export function naivePlan(n, allowed) {
  const order = AREAS.map((_, j) => j).sort((x, y) => AREAS[y].adults - AREAS[x].adults);
  const rank = { shopping: 0, station: 1, library: 2 };
  const out = [];
  for (let round = 0; out.length < n && round < 6; round++) {
    for (const j of order) {
      if (out.length >= n) break;
      const choices = allowed
        .filter((i) => SITES[i].lga === AREAS[j].name && !out.includes(i))
        .sort((a, b) => rank[SITES[a].type] - rank[SITES[b].type]);
      if (choices.length) out.push(choices[0]);
    }
  }
  return out.slice(0, n);
}

// The best possible set of k venues, by trying every combination (small k only: for checking greedy).
export function bestPossible(k, allowed, P, hidden = AREAS.map((a) => a.hidden)) {
  let best = { reach: -1, selected: [] };
  const pick = [];
  const walk = (start) => {
    if (pick.length === k) {
      const r = evaluate(pick, P, hidden).reach;
      if (r > best.reach) best = { reach: r, selected: pick.slice() };
      return;
    }
    for (let x = start; x < allowed.length; x++) {
      pick.push(allowed[x]);
      walk(x + 1);
      pick.pop();
    }
  };
  walk(0);
  return best;
}

// A small seeded random number generator (mulberry32), so everyone sees the same stress test.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULTS = { stations: 8, radius: 6, priority: 0, types: { station: true, shopping: true, library: true } };

export function allowedSites(types) {
  return SITES.filter((s) => types[s.type]).map((s) => s.id);
}

// Everything a page needs about one set of settings.
export function makePlan(settings = DEFAULTS) {
  const allowed = allowedSites(settings.types);
  const P = reachMatrix(settings.radius);
  const g = greedy(settings.stations, allowed, P, undefined, weights(settings.priority));
  const plan = { ...g, ...evaluate(g.selected, P) };
  const naiveSelected = naivePlan(Math.min(settings.stations, allowed.length), allowed);
  const naive = { selected: naiveSelected, ...evaluate(naiveSelected, P) };
  return { settings, allowed, P, plan, naive };
}

// Re-plan many times with the inputs shaken: each council's estimate ±20%, travel distance
// ±25% and each venue type's reach ±20%. Returns how often each venue was chosen.
export function stressTest(settings, runs = 300, seed = 26) {
  const random = rng(seed);
  const allowed = allowedSites(settings.types);
  const w = weights(settings.priority);
  const counts = new Map();
  for (let r = 0; r < runs; r++) {
    const hidden = AREAS.map((a) => a.hidden * (0.8 + 0.4 * random()));
    const radius = settings.radius * (0.75 + 0.5 * random());
    const mul = { station: 0.8 + 0.4 * random(), shopping: 0.8 + 0.4 * random(), library: 0.8 + 0.4 * random() };
    for (const i of greedy(settings.stations, allowed, reachMatrix(radius, mul), hidden, w).selected) {
      counts.set(i, (counts.get(i) || 0) + 1);
    }
  }
  return new Map([...counts].map(([i, c]) => [i, c / runs]));
}

export const fmt = (n) => Math.round(n).toLocaleString('en-AU');
export const round100 = (n) => Math.round(n / 100) * 100;
