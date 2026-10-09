# How HiddenPressure works

A walkthrough so you can explain every part of it.

## 1. The big picture

```
 ABS 2021 Census (adults by age, per council)      ABS Health Survey 2017–18 (by age)
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
  councils first"         with jittered inputs    top five home languages
```

## 2. File tour

| Path | Job |
|---|---|
| `index.html` | The whole app: data, estimates, optimiser, map, table, posters |
| `data/data.json` | The same data that is embedded in the page, as a separate file |
| `data/estimate.py` | Recomputes the estimates from the published figures and checks `data.json` |
| `data/SOURCES.md` | Where every number comes from |
| `tests/run-tests.mjs` | 31 model checks |
| `tests/ui-tests.mjs` | 22 interface, security and layout checks |

## 3. Key ideas

### Estimating hidden cases
For each council and each of seven age bands:

```
undiagnosed = adults × (share with high BP when measured) × (share of those who didn't report it)
```

Older people are much more likely to have high blood pressure, but also more likely to know about it. Doing the sum by age band captures both effects. The check that it works: adding up all 13 councils gives 74% unreported, against 73.7% nationally.

### How far a station reaches
A station reaches a council with probability `base × e^(−(d/R)²)`, where `d` is the distance to the council's centre and `R` is the travel distance you set. The `base` depends on the venue type: shopping centres 0.22, train stations 0.18, libraries 0.07. This is a bell-shaped distance decay: nearby residents are likely to pass by, and far-away ones almost never do.

### Not counting people twice
If two stations both reach a council with chances `p1` and `p2`, the share reached is `1 − (1 − p1)(1 − p2)`, not `p1 + p2`. That is the probability of being reached by at least one station, and it is why the optimiser spreads stations out instead of piling them into the biggest council.

### Greedy maximum coverage
Choosing the best *k* stations out of 42 exactly is a hard combinatorial problem. The greedy method adds, one at a time, the station that reaches the most people not yet reached. For coverage problems like this, greedy is proven to get at least about 63% (1 − 1/e) of the best possible result, and in practice it is usually much closer.

### The disadvantage priority
Each council gets a weight `1 + priority × (1000 − SEIFA) / 100` (never below 1). The optimiser maximises weighted reach, so stations move towards the most disadvantaged councils. The "Most disadvantaged" bar reports reach in the councils with SEIFA under 950. That is the group the weighting favours, so the bar goes up as the priority goes up, while the total reached goes down a little. That trade-off is the honest cost of equity.

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

## 5. Interview questions you might get

**Q: How do you know the estimates are reasonable?**
A: They are built from published ABS rates by age and Census populations, and the script reproduces them from the sources. The overall result of 74% unreported matches the national 73.7%. I'm clear that these are model estimates: they assume national rates by age apply locally, and the next step is to compare them with published small-area estimates.

**Q: Why greedy and not an exact optimiser?**
A: Maximum coverage is NP-hard. Greedy has a proven guarantee of at least 1 − 1/e of the optimum for this kind of problem, it is fast enough to re-run instantly when a slider moves, and it is easy to explain ("each station is the one that adds the most"). The tests check that it never does worse than the simple "biggest councils first" plan.

**Q: You found a problem in your own metric. What was it?**
A: The "disadvantaged areas" bar originally counted every council below the NSW average, including Blacktown and Penrith, which are only just below it. Raising the priority moved stations from those councils to Fairfield and Canterbury-Bankstown, so the bar went *down* even though the most disadvantaged areas gained. A test caught it, and I changed the bar to measure the councils the priority actually targets.

## 6. Ideas to extend it

1. **Suburb-level data** (SA2), so stations can be placed within a council, not just between councils.
2. **Real foot traffic** from Transport for NSW station counts, replacing the fixed reach per venue type.
3. **Exact optimisation** with integer programming for small plans, to show how close greedy gets.
