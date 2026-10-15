// Browser tests for every page at phone, tablet and desktop sizes: no errors, no sideways scrolling,
// no text on top of other text (on the maps and everywhere else), and the main interactions work.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { serve } from '../scripts/serve.mjs';

const PAGES = ['index.html', 'planner.html', 'councils.html', 'posters.html', 'method.html'];
const SIZES = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'phone', width: 390, height: 844 },
];
let server;
let browser;
let base;

before(async () => {
  server = await serve();
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
});
after(async () => {
  await browser?.close();
  server?.close();
});

async function open(path, size = SIZES[0], opts = {}) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: 'reduce', ...opts });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/GL Driver Message/.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + path);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  return { page, context, errors };
}

// Every SVG map: label boxes don't touch each other or the station markers, and stay inside the map.
async function mapProblems(page) {
  return page.evaluate(() => {
    const out = [];
    const hit = (a, b, t = 0.5) => a.left < b.right - t && b.left < a.right - t && a.top < b.bottom - t && b.top < a.bottom - t;
    for (const svg of document.querySelectorAll('.map-frame svg')) {
      const frame = svg.getBoundingClientRect();
      const labels = [...svg.querySelectorAll('.m-label')].map((g) => ({ name: g.dataset.label, r: g.querySelector('rect').getBoundingClientRect(), texts: [...g.querySelectorAll('text')].map((t) => t.getBoundingClientRect()) }));
      const markers = [...svg.querySelectorAll('.m-marker circle')].map((c) => c.getBoundingClientRect());
      labels.forEach((a, i) => {
        if (a.r.left < frame.left - 1 || a.r.right > frame.right + 1 || a.r.top < frame.top - 1 || a.r.bottom > frame.bottom + 1) out.push(`${a.name} label outside the map`);
        for (const t of a.texts) if (t.left < a.r.left - 1 || t.right > a.r.right + 1) out.push(`${a.name} text wider than its box`);
        labels.slice(i + 1).forEach((b) => { if (hit(a.r, b.r)) out.push(`${a.name} overlaps ${b.name}`); });
        markers.forEach((m, k) => {
          const inset = { left: m.left + 2, right: m.right - 2, top: m.top + 2, bottom: m.bottom - 2 };
          if (hit(a.r, inset)) out.push(`${a.name} covers marker ${k + 1}`);
        });
      });
      markers.forEach((a, i) => markers.slice(i + 1).forEach((b, k) => {
        const d = Math.hypot((a.left + a.right) / 2 - (b.left + b.right) / 2, (a.top + a.bottom) / 2 - (b.top + b.bottom) / 2);
        if (d < (a.width + b.width) / 2 - 1) out.push(`markers ${i + 1} and ${i + k + 2} overlap`);
      }));
    }
    return out;
  });
}

// All visible text on the page: no two lines of different text nodes overlap.
async function textOverlaps(page) {
  return page.evaluate(() => {
    const boxes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (el.closest('svg, .visually-hidden, [hidden], .skip, .toast, option')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width < 1 || r.height < 1) continue;
        boxes.push({ r, text: n.textContent.trim().slice(0, 40), node: n });
      }
    }
    const out = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.node === b.node) continue;
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        // Lines of text share some leading, so only a real overlap counts.
        if (w > 2 && h > Math.min(a.r.height, b.r.height) * 0.35) out.push(`"${a.text}" overlaps "${b.text}"`);
      }
    }
    return out;
  });
}

for (const path of PAGES) {
  for (const size of SIZES) {
    test(`${path} at ${size.name}: no errors, no sideways scroll, nothing overlapping`, async () => {
      const { page, context, errors } = await open(path, size);
      // Let lazily computed sections finish (method page) and reveal everything.
      await page.waitForTimeout(path === 'method.html' ? 1200 : 200);
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(scroll <= 0, `page scrolls sideways by ${scroll}px`);
      assert.deepEqual(await mapProblems(page), []);
      assert.deepEqual(await textOverlaps(page), []);
      assert.deepEqual(errors, []);
      await context.close();
    });
  }
}

test('built pages have a strict CSP and no inline scripts or styles', () => {
  for (const f of readdirSync(new URL('../site/', import.meta.url)).filter((x) => x.endsWith('.html'))) {
    const html = readFileSync(new URL(`../site/${f}`, import.meta.url), 'utf8');
    assert.match(html, /Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self';/, f);
    assert.doesNotMatch(html, /unsafe-inline|unsafe-eval/, f);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, `${f} has an inline script`);
    assert.doesNotMatch(html, /\sstyle=|<style/, `${f} has inline styles`);
    assert.doesNotMatch(html, /https?:\/\/(?!github\.com\/reihooneh)/, `${f} loads something from another site`);
  }
});

test('home: the 3D model (or its flat fallback) loads and the numbers match the model', async () => {
  const { page, context, errors } = await open('index.html');
  await page.waitForFunction(() => document.querySelector('#hero')?.dataset.mode);
  const mode = await page.$eval('#hero', (n) => n.dataset.mode);
  assert.ok(['webgl', 'flat'].includes(mode));
  assert.match(await page.textContent('h1'), /330,000/);
  await page.click('.hero-tools [data-step="1"]');
  assert.match(await page.textContent('.hero-readout b'), /Canterbury-Bankstown/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('home: works without WebGL (flat fallback)', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      return /webgl/.test(type) ? null : orig.call(this, type, ...rest);
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}index.html`);
  await page.waitForFunction(() => document.querySelector('#hero')?.dataset.mode);
  assert.equal(await page.$eval('#hero', (n) => n.dataset.mode), 'flat');
  assert.deepEqual(errors, []);
  await context.close();
});

test('planner: settings change the plan, the link and the downloads', async () => {
  const { page, context, errors } = await open('planner.html');
  assert.equal(await page.locator('#plan li').count(), 8);
  await page.fill('#stations', '12');
  assert.equal(await page.locator('#plan li').count(), 12);
  assert.equal(await page.locator('.m-marker').count(), 12);
  assert.match(page.url(), /#n=12&r=6&p=0&t=111$/);
  assert.deepEqual(await mapProblems(page), []);

  const before = await page.textContent('#summary-kv dd');
  await page.fill('#priority', '3');
  const afterText = await page.textContent('#summary-kv dd');
  assert.ok(parseFloat(afterText) > parseFloat(before), `${afterText} vs ${before}`);

  await page.click('#types input[value="shopping"]');
  await page.click('#types input[value="station"]');
  const types = await page.$$eval('#plan .what span', (s) => s.map((x) => x.textContent));
  assert.ok(types.every((t) => t.startsWith('Library')), types.join());
  await page.click('#types input[value="library"]'); // the last type can't be switched off
  assert.ok(await page.isChecked('#types input[value="library"]'));

  await page.click('[data-view="region"]');
  assert.deepEqual(await mapProblems(page), []);

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#csv')]);
  assert.match(download.suggestedFilename(), /^hiddenpressure-plan-12-stations\.csv$/);

  await page.click('#stress');
  await page.waitForSelector('#stability .stab-row');
  assert.ok((await page.locator('#stability .stab-row').count()) >= 3);

  await page.click('#plan li >> nth=0');
  assert.match(await page.textContent('#detail'), /Best time/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('planner: bad values in the link fall back to the defaults', async () => {
  const { page, context, errors } = await open('planner.html#n=999&r=-1&p=x&t=000');
  assert.equal(await page.inputValue('#stations'), '8');
  assert.equal(await page.inputValue('#radius'), '6');
  assert.equal(await page.locator('#types input:checked').count(), 3);
  assert.deepEqual(errors, []);
  await context.close();
});

test('councils: choosing, sorting and keyboard use', async () => {
  const { page, context, errors } = await open('councils.html#Fairfield');
  assert.equal(await page.textContent('#profile h2'), 'Fairfield');
  await page.click('.chip:has-text("Penrith")');
  assert.equal(await page.textContent('#profile h2'), 'Penrith');
  assert.ok(await page.locator('.m-label[data-label="Penrith"]').count(), 'the chosen council is always labelled');
  await page.click('#table th[data-key="rate"] button');
  const first = await page.textContent('#table tbody tr:first-child th');
  assert.equal(first, 'Blue Mountains');
  await page.focus('#table tbody tr:nth-child(2)');
  await page.keyboard.press('Enter');
  assert.notEqual(await page.textContent('#profile h2'), 'Penrith');
  assert.deepEqual(errors, []);
  await context.close();
});

test('posters: a venue poster shows the venue and the chosen number of languages', async () => {
  const { page, context, errors } = await open('posters.html#site=0');
  assert.match(await page.textContent('.poster-foot'), /Parramatta Station/);
  await page.fill('#count', '5');
  assert.equal(await page.locator('.poster-line').count(), 5);
  await page.selectOption('#for', 'council=Fairfield');
  // Assyrian and Chaldean have no checked line, so the poster says a translator is needed.
  assert.equal(await page.locator('.poster-line.missing').count(), 2);
  assert.deepEqual(await textOverlaps(page), []);
  assert.deepEqual(errors, []);
  await context.close();
});

test('dark theme switch works and is remembered', async () => {
  const { page, context } = await open('method.html');
  await page.click('.theme-btn');
  const theme = await page.getAttribute('html', 'data-theme');
  await page.goto(`${base}index.html`);
  assert.equal(await page.getAttribute('html', 'data-theme'), theme);
  await context.close();
});
