// Checks the model: the estimates against the survey, and the optimiser against brute force.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AREAS, TOTALS, SITES, DEFAULTS, allowedSites, bestPossible, evaluate, greedy, makePlan, naivePlan,
  reachMatrix, stressTest, weights, MOST_DISADVANTAGED,
} from '../site/assets/js/model.js';
import { DATA } from '../site/assets/js/data.js';

test('13 councils, 42 venues, every venue in a study council', () => {
  assert.equal(AREAS.length, 13);
  assert.equal(SITES.length, 42);
  const names = new Set(AREAS.map((a) => a.name));
  for (const s of SITES) assert.ok(names.has(s.lga), s.name);
});

test('age bands add up to the adult population', () => {
  for (const a of AREAS) {
    const sum = a.bands.reduce((s, b) => s + b, 0);
    assert.ok(Math.abs(sum - a.adults) <= 7, `${a.name}: ${sum} vs ${a.adults}`);
  }
});

test('unreported share is close to the national survey (74.5%)', () => {
  const share = (TOTALS.hidden / TOTALS.high) * 100;
  assert.ok(Math.abs(share - 74.5) < 2, `got ${share.toFixed(1)}%`);
});

test('measured high prevalence is plausible (national 23.3%, younger region)', () => {
  const p = (TOTALS.high / TOTALS.adults) * 100;
  assert.ok(p > 19 && p < 24.5, `got ${p.toFixed(1)}%`);
});

test('total likely undiagnosed is in a sane range', () => {
  assert.ok(TOTALS.hidden > 300000 && TOTALS.hidden < 360000, String(TOTALS.hidden));
});

test('uses the NHS 2022 rates', () => {
  assert.deepEqual(DATA.bands[0], ['18-24', 4.5, 92.3]);
  assert.deepEqual(DATA.bands[6], ['75+', 42.9, 54.0]);
});

test('coverage is between 0 and 1 and grows as venues are added', () => {
  const P = reachMatrix(6);
  const allowed = allowedSites(DEFAULTS.types);
  let prev = 0;
  for (let n = 1; n <= 15; n++) {
    const { selected } = greedy(n, allowed, P);
    const r = evaluate(selected, P);
    r.coverage.forEach((c) => assert.ok(c >= 0 && c <= 1));
    assert.ok(r.reach >= prev - 1e-9, `n=${n}`);
    prev = r.reach;
  }
});

test('greedy beats or matches the obvious plan for 1 to 15 stations', () => {
  const P = reachMatrix(6);
  const allowed = allowedSites(DEFAULTS.types);
  for (let n = 1; n <= 15; n++) {
    const g = evaluate(greedy(n, allowed, P).selected, P).reach;
    const v = evaluate(naivePlan(n, allowed), P).reach;
    assert.ok(g >= v - 1e-6, `n=${n}: ${g} < ${v}`);
  }
});

test('greedy is within the (1 - 1/e) bound of the best possible, and in fact close', () => {
  const P = reachMatrix(6);
  const allowed = allowedSites(DEFAULTS.types);
  for (let k = 1; k <= 3; k++) {
    const g = evaluate(greedy(k, allowed, P).selected, P).reach;
    const b = bestPossible(k, allowed, P).reach;
    assert.ok(g <= b + 1e-6);
    assert.ok(g >= 0.95 * b, `k=${k}: ${g / b}`);
  }
});

test('gains add up to the plan reach (no double counting)', () => {
  const { plan } = makePlan(DEFAULTS);
  const sum = plan.gains.reduce((s, g) => s + g, 0);
  assert.ok(Math.abs(sum - plan.reach) < 1e-6);
});

test('the disadvantage focus raises reach in the most disadvantaged councils', () => {
  const off = makePlan({ ...DEFAULTS, priority: 0 }).plan.disadvantaged;
  const on = makePlan({ ...DEFAULTS, priority: 3 }).plan.disadvantaged;
  assert.ok(on > off, `${on} <= ${off}`);
  assert.ok(AREAS.some((a) => a.irsd < MOST_DISADVANTAGED));
  assert.ok(weights(2).every((w) => w >= 1));
});

test('venue type filter is respected', () => {
  const plan = makePlan({ ...DEFAULTS, types: { station: false, shopping: false, library: true } });
  for (const i of plan.plan.selected) assert.equal(SITES[i].type, 'library');
});

test('stress test is reproducible and returns shares between 0 and 1', () => {
  const a = stressTest(DEFAULTS, 40, 7);
  const b = stressTest(DEFAULTS, 40, 7);
  assert.deepEqual([...a], [...b]);
  for (const v of a.values()) assert.ok(v > 0 && v <= 1);
});

test('every study council has a boundary and a label point inside the map', () => {
  const study = DATA.boundaries.filter((b) => b.study);
  assert.equal(study.length, 13);
  for (const b of study) {
    assert.ok(b.polygons.length > 0);
    assert.ok(b.label[0] > 150 && b.label[0] < 151.2 && b.label[1] > -34.4 && b.label[1] < -33);
  }
});
