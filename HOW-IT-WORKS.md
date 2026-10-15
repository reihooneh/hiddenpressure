# How HiddenPressure works

A walkthrough so you can explain every part of it.

## 1. The big picture

```
 ABS 2021 Census (adults by age, per council)      ABS Health Survey 2022 (by age)
               │                                   % with high BP when measured
               │                                   % of those who didn't report it
               └──────────────┬────────────────────┘
                              ▼
            estimated undiagnosed adults per council   (data/estimate.py checks these)
                              │
 42 venues ─▶ reach matrix P[venue][council] = base(type) × e^(−(distance / R)²)
                              │
                              ▼
        greedy maximum coverage: add the venue that reaches the most *extra* people
                              │
          ┌───────────────────┼────────────────────────┐
          ▼                   ▼                        ▼
  compare with "biggest   stress test: 300 runs   posters in the council's
  councils first"         with jittered inputs    top home languages

 scripts/build.mjs:  data/*.json + src/pages/*.html  ──▶  site/  (5 pages, published by CI)
```

## 2. File tour

| Path | Job |
|---|---|
| `data/data.json` | Councils (ages, languages, SEIFA, centre), 42 venues, the survey rates |
| `data/lga.json` | Simplified ABS council boundaries (13 study councils plus neighbours) |
| `data/estimate.py` | Recomputes the estimates from the published figures and checks `data.json` |
| `scripts/build.mjs` | Builds `site/`: the data module with label points, the pages (shared header, footer, CSP and numbers from the model), and copies three.js and the fonts |
| `src/pages/*.html` | The content of the five pages |
| `site/assets/js/model.js` | The model: estimates, reach, greedy, brute force, stress test. No DOM, so Node tests use it too |
| `site/assets/js/map.js` | The SVG map and the label placement |
| `site/assets/js/hero3d.js` | The 3D model on the overview page, with a flat fallback |
| `site/assets/js/components.js` | Age chart, comparison bars, plan list and posters |
| `site/assets/js/{home,planner,councils,posters,method}.js` | One script per page |
| `site/assets/css/site.css` | The design system: colours, type, layout, light and dark, print |
| `tests/model.test.mjs` | 14 model tests |
| `tests/site.test.mjs` | 23 browser tests, including the overlap checks |

## 3. Key ideas

### Estimating hidden cases
For each council and each of seven age bands:

```
undiagnosed = adults × (share with high BP when measured) × (share of those who didn't report it)
```

Older people are much more likely to have high blood pressure, but also more likely to know about it. Doing the sum by age band captures both effects. The check that it works: adding up all 13 councils gives 75.7% unreported, against 74.5% nationally (2022). It's a little higher because Western Sydney is younger, and younger people are less likely to know.

### How far a station reaches
A station reaches a council with probability `base × e^(−(d/R)²)`, where `d` is the distance to the council's centre and `R` is the travel distance you set. The `base` depends on the venue type: shopping centres 0.22, train stations 0.18, libraries 0.07. This is a bell-shaped distance decay: nearby residents are likely to pass by, and far-away ones almost never do.

### Not counting people twice
If two stations both reach a council with chances `p1` and `p2`, the share reached is `1 − (1 − p1)(1 − p2)`, not `p1 + p2`. That is the probability of being reached by at least one station, and it is why the optimiser spreads stations out instead of piling them into the biggest council.

### Greedy maximum coverage
Choosing the best *k* stations out of 42 exactly is a hard combinatorial problem. The greedy method adds, one at a time, the station that reaches the most people not yet reached. For coverage problems like this, greedy is proven to get at least about 63% (1 − 1/e) of the best possible result, and in practice it is usually much closer.

### The disadvantage priority
Each council gets a weight `1 + priority × (1000 − SEIFA) / 100` (never below 1). The optimiser maximises weighted reach, so stations move towards the most disadvantaged councils. The "Most disadvantaged" bar reports reach in the councils with SEIFA under 950. That is the group the weighting favours, so the bar goes up as the priority goes up, while the total reached goes down a little. That trade-off is the honest cost of equity.

### Placing map labels without overlaps
Small councils in the east are crowded, so fixed label positions would collide. `map.js` places labels at run time, smallest councils first (they have the least room), with the selected council always first:

1. Measure the label's width with the real font (after `document.fonts.ready`).
2. Try the label's anchor point, then rings of positions further out at 24 angles.
3. Reject a position if it leaves the map, touches another label, a station marker, a pin, the scale bar or north arrow, or crosses a leader line. Prefer positions close to the anchor and inside the council.
4. If the label moved off its council, draw a leader line to a dot at the anchor.
5. If nothing fits, try the name without the number. If that doesn't fit either, list it under the map instead of drawing it on top of something.

Stations near each other are pushed apart a few pixels at a time until they don't touch, and pinned to their true position with a short line. Sizes are worked out in screen pixels, so the result holds on a phone too. The browser tests check every map at three screen sizes, and every line of text on every page, for overlaps.

### The 3D model
Each council's real boundary becomes a `THREE.Shape`, extruded upwards by its number of likely undiagnosed people and coloured by its rate. It's lit by a sky light and a sun with soft shadows. It only renders while on screen, stays still if you've asked for reduced motion, and switches to a flat SVG map if WebGL isn't available.

### Stress test
Inputs are estimates, so the plan should not depend on lucky numbers. The stress test re-runs the optimiser 300 times. Each run moves every council's estimate by ±20%, the travel distance by ±25% and each venue type's reach by ±20%, at random. A station chosen in at least 80% of runs is robust. The randomness is seeded, so everyone sees the same result.

## 4. Glossary

| Term | Plain version |
|---|---|
| Hypertension | High blood pressure |
| LGA | Local Government Area: a council |
| SEIFA IRSD | An ABS score of socio-economic disadvantage; below 1,000 is more disadvantaged than average |
| Maximum coverage | Choose *k* places to cover as many people as possible |
| Greedy algorithm | Build an answer by always taking the best next step |
| Sensitivity analysis | Checking whether the answer changes when the inputs change |
| Leader line | A thin line joining a label to the place it describes |
| Extrusion | Turning a flat shape into a 3D block by giving it height |

## 5. Interview questions you might get

**Q: How do you know the estimates are reasonable?**
A: They are built from published ABS rates by age and Census populations, and the script reproduces them from the sources. The overall result of 75.7% unreported is close to the national 74.5%, and the difference has a reason: the region is younger. I'm clear that these are model estimates: they assume national rates by age apply locally, and the next step is to compare them with published small-area estimates.

**Q: Why greedy and not an exact optimiser?**
A: Maximum coverage is NP-hard. Greedy has a proven guarantee of at least 1 − 1/e of the optimum for this kind of problem, it is fast enough to re-run instantly when a slider moves, and it is easy to explain ("each station is the one that adds the most"). The tests check that it never does worse than the simple "biggest councils first" plan.

**Q: How do you make sure nothing on the map overlaps?**
A: Labels aren't fixed: each one searches for a free spot around its council, treating other labels, markers, leader lines and the map edge as obstacles, and falls back to a shorter label or a list under the map. Then I test it: Playwright opens every page at phone, tablet and desktop size and checks that no label box intersects another or a marker, and that no two lines of text on the page overlap. I also checked the test itself by deliberately moving a label onto another and confirming it failed.

**Q: You found a problem in your own metric. What was it?**
A: The "disadvantaged areas" bar originally counted every council below the NSW average, including Blacktown and Penrith, which are only just below it. Raising the priority moved stations from those councils to Fairfield and Canterbury-Bankstown, so the bar went *down* even though the most disadvantaged areas gained. A test caught it, and I changed the bar to measure the councils the priority actually targets.

## 6. Ideas to extend it

1. **Suburb-level data** (SA2), so stations can be placed within a council, not just between councils.
2. **Real foot traffic** from Transport for NSW station counts, replacing the fixed reach per venue type.
3. **Exact optimisation** with integer programming for larger plans (brute force already confirms greedy is optimal up to 4 stations).
