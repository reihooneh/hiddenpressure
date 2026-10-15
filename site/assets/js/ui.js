// Small shared helpers: building DOM safely (text only, never innerHTML), the header menu,
// the theme switch, scroll reveals and colour classes.

const SVG_NS = 'http://www.w3.org/2000/svg';

// el('p', { class: 'x', text: 'hello' }, child, ...). Attributes are set one by one and text goes in
// as text nodes, so data can never become markup.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  return fill(node, attrs, children);
}
export function sv(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  return fill(node, attrs, children);
}
function fill(node, attrs, children) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'style') throw new Error('Use classes, not inline styles (the page has a strict CSP)');
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Five-step colour class for a value between lo and hi.
export function heatStep(v, lo, hi) {
  if (hi <= lo) return 2;
  return Math.max(0, Math.min(4, Math.floor(((v - lo) / (hi - lo)) * 5)));
}

export function storage(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch (e) { /* storage unavailable: nothing to remember */ }
  return null;
}

let toastTimer = 0;
export function toast(message) {
  let t = $('.toast');
  if (!t) document.body.append((t = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' })));
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

export const onThemeChange = new Set();
function currentTheme() {
  const set = document.documentElement.getAttribute('data-theme');
  if (set) return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function initHeader() {
  const menu = $('.menu-btn');
  const nav = $('.nav');
  if (menu && nav) {
    menu.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        menu.setAttribute('aria-expanded', 'false');
        menu.focus();
      }
    });
  }
  const themeBtn = $('.theme-btn');
  if (themeBtn) {
    const label = () => themeBtn.setAttribute('aria-label', currentTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    label();
    themeBtn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      storage('hp-theme', next);
      label();
      onThemeChange.forEach((fn) => fn(next));
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      label();
      onThemeChange.forEach((fn) => fn(currentTheme()));
    });
  }
}

function initReveal() {
  const items = $$('.reveal');
  if (!('IntersectionObserver' in window) || reducedMotion()) {
    items.forEach((n) => n.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    }),
    { rootMargin: '0px 0px -8% 0px' },
  );
  items.forEach((n) => io.observe(n));
}

// Bars animate from zero when they scroll into view; widths are set through the CSSOM
// (allowed by the CSP, unlike style attributes).
export function setBar(fillNode, fraction) {
  const pct = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
  if (reducedMotion() || !('IntersectionObserver' in window)) {
    fillNode.style.width = pct;
    return;
  }
  fillNode.dataset.target = pct;
  barObserver.observe(fillNode);
}
const barObserver =
  typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.style.width = e.target.dataset.target;
        barObserver.unobserve(e.target);
      }
    }))
    : null;

// Counts a number up when it first appears.
export function countUp(node, value, format) {
  const done = () => { node.textContent = format(value); };
  if (reducedMotion() || !('IntersectionObserver' in window)) return done();
  node.textContent = format(0);
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1100);
      node.textContent = format(value * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  io.observe(node);
}

initHeader();
initReveal();
