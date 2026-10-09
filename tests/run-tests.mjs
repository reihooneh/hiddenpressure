// HiddenPressure model checks. From the repo root: npm install && npx playwright install chromium && npm test
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch(); const p = await b.newPage();
await p.goto("file://" + path.join(here, "..", "index.html"));
const r = await p.evaluate(() => {
  const H = window.HiddenPressure, A = H.AREAS;
  const undx = A.reduce((s, a) => s + a.undx, 0), hbp = A.reduce((s, a) => s + a.hbp, 0);
  const all = H.SITES.map(s => s.id), P = H.reachMatrix(6), u = A.map(a => a.undx), w = A.map(() => 1);
  const res = [];
  for (let n = 1; n <= 15; n++) {
    const g = H.greedy(n, all, P, u, w), nv = H.naivePlan(n, all);
    res.push({ n, plan: H.evaluate(g.sel, P, u).reach, naive: H.evaluate(nv, P, u).reach, k: g.sel.length });
  }
  return { share: undx / hbp, total: undx, res };
});
let pass = 0, total = 0;
const check = (name, ok) => { total++; if (ok) pass++; console.log((ok ? "PASS " : "FAIL ") + name); };
check(`unreported share ${(r.share * 100).toFixed(1)}% is within 2 points of ABS national 73.7%`, Math.abs(r.share * 100 - 73.7) < 2);
check(`total estimate ${Math.round(r.total)} is between 300,000 and 350,000`, r.total > 3e5 && r.total < 3.5e5);
for (const x of r.res) check(`n=${x.n}: optimised plan (${Math.round(x.plan)}) reaches at least as many as biggest-councils plan (${Math.round(x.naive)})`, x.plan >= x.naive - 1 && x.k === x.n);
for (let i = 1; i < r.res.length; i++) check(`n=${i + 1}: adding a station never lowers reach`, r.res[i].plan >= r.res[i - 1].plan);
console.log(`\n${pass}/${total} passed`); await b.close(); process.exit(pass === total ? 0 : 1);
