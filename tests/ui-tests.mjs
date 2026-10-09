// HiddenPressure interface, robustness and security tests, run in a real browser.
//   npm install && npx playwright install chromium && npm test
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, "..", "index.html");
const PAGE = "file://" + FILE;

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log((ok ? "PASS " : "FAIL ") + name + (ok || !detail ? "" : "\n   " + detail));
}

const browser = await chromium.launch();

async function open(width = 1280) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  const requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await page.route(/^https?:\/\//, (route) => route.abort());
  await page.goto(PAGE);
  return { page, errors, requests };
}
const text = (page, sel) => page.locator(sel).first().textContent();
const setRange = (page, sel, value) =>
  page.$eval(sel, (el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
const reached = async (page) => Number((await text(page, "#vPlan")).replace(/,/g, ""));

// 1. The headline numbers match the abstract and the data.
{
  const { page, errors } = await open();
  check("estimates about 325,400 adults with unreported high blood pressure", (await text(page, "#kTotal")) === "~325,400");
  check("74% of adults with high readings are unreported, matching the national 73.7%", /^74% of/.test(await text(page, "#kTotalSub")));
  check("8 stations reach about 61,900 people, 16% more than the biggest-councils plan", (await text(page, "#kReach")) === "61,949" && (await text(page, "#kGain")) === "+16%");
  check("the plan lists 8 stations", (await page.locator("#plan li").count()) === 8);

  // 2. Controls.
  let last = -1;
  let monotone = true;
  let counts = true;
  for (let n = 1; n <= 15; n++) {
    await setRange(page, "#nSt", n);
    const r = await reached(page);
    if (r < last) monotone = false;
    last = r;
    if ((await page.locator("#plan li").count()) !== n) counts = false;
  }
  check("the station slider gives exactly that many stations, from 1 to 15", counts);
  check("adding stations never lowers the number reached", monotone);

  await setRange(page, "#nSt", 8);
  for (const id of ["#vStation", "#vShopping", "#vLibrary"]) await page.uncheck(id);
  check("with no venue types allowed, the app explains instead of failing", /Allow at least one venue type/.test(await text(page, "#plan")) && errors.length === 0, errors.join("; "));
  for (const id of ["#vStation", "#vShopping", "#vLibrary"]) await page.check(id);

  await setRange(page, "#fair", 0);
  const disOff = Number((await text(page, "#vDis")).replace(/,/g, ""));
  await setRange(page, "#fair", 2);
  const disOn = Number((await text(page, "#vDis")).replace(/,/g, ""));
  check("raising the disadvantage priority reaches more people in the most disadvantaged councils", disOn > disOff, `${disOff} -> ${disOn}`);
  await setRange(page, "#fair", 0);

  // 3. The stress test is repeatable.
  await page.click("#stress");
  await page.waitForFunction(() => /Stress test done/.test(document.getElementById("status").textContent));
  const first = await text(page, "#status");
  await page.click("#stress");
  await page.waitForFunction(() => /Stress test done/.test(document.getElementById("status").textContent));
  check("the stress test gives the same result every time (seeded randomness)", first === (await text(page, "#status")) && /5 of 8 stations/.test(first));
  check("each station shows how stable it is", (await page.locator("#plan .stab").count()) === 8);

  // 4. Posters and details.
  await page.locator("#tbl tbody tr", { hasText: "Fairfield" }).click();
  const poster = await text(page, "#poster");
  check("Fairfield's poster covers Vietnamese and Arabic", /Đo huyết áp miễn phí/.test(poster) && /فحص ضغط الدم/.test(poster));
  check("languages with no checked phrase (Assyrian, Chaldean) are flagged for a translator, not guessed", (poster.match(/Needs a community translator/g) || []).length === 2);
  check("Arabic poster text is right to left", (await page.$eval('#poster [lang="ar"]', (e) => e.getAttribute("dir"))) === "rtl");

  await page.click('#tbl th button[data-k="name"]');
  const names = await page.$$eval("#tbl tbody tr td:first-child", (tds) => tds.map((t) => t.textContent));
  check("the council table sorts by name", names.join() === [...names].sort((a, b) => a.localeCompare(b)).join());

  await page.locator("#map g.area").first().focus();
  await page.keyboard.press("Enter");
  check("councils on the map can be chosen with the keyboard", / council$/.test(await text(page, "#dTitle")));
  check("no script errors through all of the above", errors.length === 0, errors.join("; "));
  await page.close();
}

// 5. Security and privacy.
{
  const { page, requests } = await open();
  await setRange(page, "#nSt", 12);
  await page.click("#stress");
  await page.waitForFunction(() => /Stress test done/.test(document.getElementById("status").textContent));
  const offsite = requests.filter((u) => /^https?:/.test(u) && !/fonts\.(googleapis|gstatic)\.com/.test(u));
  check("no network requests except the web fonts", offsite.length === 0, offsite.join(", "));
  const csp = await page.$eval('meta[http-equiv="Content-Security-Policy"]', (m) => m.content);
  check("the Content-Security-Policy forbids network connections from scripts and blocks plug-ins, base tags and form posts",
    /connect-src 'none'/.test(csp) && /object-src 'none'/.test(csp) && /base-uri 'none'/.test(csp) && /form-action 'none'/.test(csp));
  const source = readFileSync(FILE, "utf8");
  check("the page never builds HTML from strings (no innerHTML, eval or document.write)", !/innerHTML|outerHTML|insertAdjacentHTML|\beval\(|document\.write|new Function/.test(source));
  await page.close();
}

// 6. Phone, tablet and laptop widths.
for (const width of [360, 768, 1280]) {
  const { page } = await open(width);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`no sideways scrolling at ${width}px wide (the wide table scrolls inside its own box)`, overflow <= 0, `${overflow}px too wide`);
  await page.close();
}

await browser.close();
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail === 0 ? 0 : 1);
