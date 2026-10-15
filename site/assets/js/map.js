// The council map: real boundaries, a colour scale, venue markers and catchment rings,
// with labels placed at run time so no text ever sits on another label or on a marker.
import { DATA } from './data.js';
import { AREAS, SITES, VENUE_TYPES } from './model.js';
import { el, sv, heatStep } from './ui.js';

const LAT0 = -33.8;
const COS0 = Math.cos((LAT0 * Math.PI) / 180);
const KM_X = 111.32 * COS0; // km per degree of longitude here
const KM_Y = 110.57;

const VIEWS = {
  region: { lon: [150.0, 151.17], lat: [-34.35, -32.98], label: 'Whole region' },
  urban: { lon: [150.62, 151.17], lat: [-34.12, -33.62], label: 'Urban core' },
};

const BOUNDARY = new Map(DATA.boundaries.map((b) => [b.name, b]));

// ---------- geometry helpers ----------
const rectsOverlap = (a, b, gap = 0) =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
function circleRect(c, r, gap = 0) {
  const nx = Math.max(r.x, Math.min(c.x, r.x + r.w));
  const ny = Math.max(r.y, Math.min(c.y, r.y + r.h));
  return Math.hypot(c.x - nx, c.y - ny) < c.r + gap;
}
function segmentHitsRect(p, q, r) {
  // Liang–Barsky clip: does the segment p→q pass through rectangle r?
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const edges = [[-dx, p.x - r.x], [dx, r.x + r.w - p.x], [-dy, p.y - r.y], [dy, r.y + r.h - p.y]];
  for (const [pp, qq] of edges) {
    if (pp === 0) { if (qq < 0) return false; continue; }
    const t = qq / pp;
    if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t1 - t0 > 0.02;
}
function pointInRings(pt, polygons) {
  let inside = false;
  for (const poly of polygons) for (const ring of poly) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

let measureCtx = null;
function textWidth(text, font) {
  measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

/**
 * createMap(host, options) draws into host and returns { render(state) }.
 * state: { view, values: number[13], valueText(j), selected: site ids, allowed: site ids,
 *          radius (km, or 0 for no rings), activeArea, activeSite }
 * options: { onArea(j), onSite(i), ariaLabel, compact }
 */
export function createMap(host, options = {}) {
  const frame = el('div', { class: 'map-frame' });
  const svg = sv('svg', { role: 'group', 'aria-label': options.ariaLabel || 'Map of Western Sydney councils' });
  const note = el('p', { class: 'map-unplaced', hidden: true });
  frame.append(svg);
  host.append(frame, note);
  let last = null;
  let lastWidth = 0;

  let lastHeight = 0;
  const ro = new ResizeObserver(() => {
    const r = svg.getBoundingClientRect();
    if (last && r.width && (Math.abs(r.width - lastWidth) > 4 || Math.abs(r.height - lastHeight) > 4)) render(last);
  });
  ro.observe(svg);

  function render(state) {
    last = state;
    const view = VIEWS[state.view] || VIEWS.region;
    const W = 1000;
    const kmW = (view.lon[1] - view.lon[0]) * KM_X;
    const kmH = (view.lat[1] - view.lat[0]) * KM_Y;
    const H = Math.round((W * kmH) / kmW);
    const unit = W / kmW; // viewBox units per km
    const P = (lon, lat) => ({ x: (lon - view.lon[0]) * KM_X * unit, y: (view.lat[1] - lat) * KM_Y * unit });
    const pathOf = (polygons) =>
      polygons.map((poly) => poly.map((ring) => ring.map(([x, y], i) => {
        const p = P(x, y);
        return `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      }).join('') + 'Z').join('')).join('');

    // Everything that should look the same size on screen is scaled by s = viewBox units per CSS pixel.
    // The map may be letterboxed (limited height), so take whichever side limits the scale.
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const box = svg.getBoundingClientRect();
    lastWidth = box.width || frame.clientWidth || 800;
    lastHeight = box.height || (lastWidth * H) / W;
    const s = Math.max(W / lastWidth, H / lastHeight);
    svg.replaceChildren();

    const clipId = `clip-${Math.random().toString(36).slice(2, 8)}`;
    svg.append(sv('defs', {}, sv('clipPath', { id: clipId }, sv('rect', { x: 0, y: 0, width: W, height: H }))));
    const world = sv('g', { 'clip-path': `url(#${clipId})` });
    svg.append(world);

    // Neighbouring councils for context, then the 13 study councils coloured by value.
    for (const b of DATA.boundaries) if (!b.study) world.append(sv('path', { class: 'm-neighbour', d: pathOf(b.polygons), 'aria-hidden': 'true' }));
    const lo = Math.min(...state.values);
    const hi = Math.max(...state.values);
    AREAS.forEach((a, j) => {
      const b = BOUNDARY.get(a.name);
      const step = heatStep(state.values[j], lo, hi);
      const dim = options.focus && state.activeArea !== null && state.activeArea !== undefined && state.activeArea !== j;
      const node = sv('path', {
        class: `m-area ${state.palette === 'cool' ? 'cool' : 'heat'}-${step}${state.activeArea === j ? ' active' : ''}${dim ? ' dim' : ''}`,
        d: pathOf(b.polygons),
        tabindex: options.onArea ? 0 : null,
        role: options.onArea ? 'button' : 'img',
        'aria-label': `${a.name}: ${state.valueText(j)}`,
      }, sv('title', { text: `${a.name}: ${state.valueText(j)}` }));
      if (options.onArea) {
        node.addEventListener('click', () => options.onArea(j));
        node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); options.onArea(j); } });
      }
      world.append(node);
    });

    const inView = (p, m = 0) => p.x >= m && p.x <= W - m && p.y >= m && p.y <= H - m;

    // Catchment rings: at R km a venue reaches e^-1 (37%) of its full reach.
    const selected = state.selected || [];
    if (state.radius) {
      for (const i of selected) {
        const p = P(SITES[i].lon, SITES[i].lat);
        world.append(sv('circle', { class: 'm-ring', cx: p.x, cy: p.y, r: state.radius * unit }));
      }
    }

    // Venues that could be chosen but weren't: small dots.
    const dots = [];
    for (const i of state.allowed || []) {
      if (selected.includes(i)) continue;
      const p = P(SITES[i].lon, SITES[i].lat);
      if (!inView(p)) continue;
      dots.push({ x: p.x, y: p.y, r: 3.2 * s });
      world.append(sv('circle', { class: `m-venue ${SITES[i].type}`, cx: p.x, cy: p.y, r: 3.2 * s, 'aria-hidden': 'true' },
        sv('title', { text: `${SITES[i].name} (${VENUE_TYPES[SITES[i].type].name.toLowerCase()})` })));
    }

    // Chosen venues: numbered markers. Venues close together are spread apart and pinned
    // to their true spot with a short line, so markers never cover each other.
    const R = 11 * s;
    const markers = selected.map((i, k) => {
      const p = P(SITES[i].lon, SITES[i].lat);
      return { i, k, home: p, x: p.x, y: p.y, r: R };
    }).filter((m) => inView(m.home));
    for (let iter = 0; iter < 120; iter++) {
      let moved = false;
      for (let a = 0; a < markers.length; a++) for (let b = a + 1; b < markers.length; b++) {
        const A = markers[a];
        const B = markers[b];
        let dx = B.x - A.x;
        let dy = B.y - A.y;
        let d = Math.hypot(dx, dy);
        const need = A.r + B.r + 3 * s;
        if (d >= need) continue;
        if (d < 1e-6) { dx = 1; dy = -1; d = Math.SQRT2; }
        const push = (need - d) / 2 + 0.01;
        A.x -= (dx / d) * push; A.y -= (dy / d) * push;
        B.x += (dx / d) * push; B.y += (dy / d) * push;
        moved = true;
      }
      for (const m of markers) {
        m.x = Math.max(m.r + 2 * s, Math.min(W - m.r - 2 * s, m.x));
        m.y = Math.max(m.r + 2 * s, Math.min(H - m.r - 2 * s, m.y));
      }
      if (!moved) break;
    }
    const markerLayer = sv('g');
    for (const m of markers) {
      if (Math.hypot(m.x - m.home.x, m.y - m.home.y) > m.r * 0.6) {
        world.append(sv('line', { class: 'm-leader', x1: m.home.x, y1: m.home.y, x2: m.x, y2: m.y, 'stroke-width': 1.1 * s }));
        world.append(sv('circle', { class: 'm-pin', cx: m.home.x, cy: m.home.y, r: 2.6 * s }));
      }
      const site = SITES[m.i];
      const g = sv('g', {
        class: `m-marker${state.activeSite === m.i ? ' active' : ''}`,
        transform: `translate(${m.x.toFixed(1)} ${m.y.toFixed(1)})`,
        tabindex: options.onSite ? 0 : null,
        role: options.onSite ? 'button' : 'img',
        'aria-label': `Station ${m.k + 1}: ${site.name}`,
        'data-marker': m.k + 1,
      }, sv('title', { text: `${m.k + 1}. ${site.name}` }), sv('circle', { r: m.r }), sv('text', { 'font-size': 11 * s, text: m.k + 1 }));
      if (options.onSite) {
        g.addEventListener('click', () => options.onSite(m.i));
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); options.onSite(m.i); } });
      }
      markerLayer.append(g);
    }

    // Furniture: scale bar (bottom left) and north arrow (top right). Their boxes are obstacles too.
    const furniture = [];
    const scaleKm = state.view === 'urban' ? 5 : 10;
    const sx = 14 * s;
    const sy = H - 16 * s;
    const scale = sv('g', { class: 'm-scale', 'aria-hidden': 'true' },
      sv('line', { x1: sx, y1: sy, x2: sx + scaleKm * unit, y2: sy, 'stroke-width': 1.5 * s }),
      sv('line', { x1: sx, y1: sy - 4 * s, x2: sx, y2: sy + 1 * s, 'stroke-width': 1.5 * s }),
      sv('line', { x1: sx + scaleKm * unit, y1: sy - 4 * s, x2: sx + scaleKm * unit, y2: sy + 1 * s, 'stroke-width': 1.5 * s }),
      sv('text', { x: sx, y: sy - 7 * s, 'font-size': 10 * s, text: `${scaleKm} km` }));
    furniture.push({ x: sx - 4 * s, y: sy - 20 * s, w: scaleKm * unit + 10 * s, h: 24 * s });
    const nx = W - 22 * s;
    const ny = 16 * s;
    const north = sv('g', { class: 'm-north', 'aria-hidden': 'true' },
      sv('path', { d: `M${nx} ${ny}l${6 * s} ${16 * s}l${-6 * s} ${-4 * s}l${-6 * s} ${4 * s}z` }),
      sv('text', { x: nx, y: ny + 28 * s, 'font-size': 10 * s, 'text-anchor': 'middle', text: 'N' }));
    furniture.push({ x: nx - 10 * s, y: ny - 4 * s, w: 20 * s, h: 36 * s });
    const attribText = 'Boundaries: ABS ASGS 2021 (CC BY 4.0)';
    const attribW = textWidth(attribText, `9px Inter`) * s;
    const attrib = sv('text', { class: 'm-attrib', x: W - 8 * s, y: H - 7 * s, 'font-size': 9 * s, 'text-anchor': 'end', text: attribText });
    furniture.push({ x: W - 10 * s - attribW, y: H - 18 * s, w: attribW + 4 * s, h: 14 * s });

    // ---------- labels ----------
    const nameFont = 12;
    const valueFont = 11;
    const lineH = 15;
    const pad = 5;
    const hard = [...furniture];
    const markerCircles = markers.map((m) => ({ x: m.x, y: m.y, r: m.r }));
    const pins = markers.filter((m) => Math.hypot(m.x - m.home.x, m.y - m.home.y) > m.r * 0.6).map((m) => ({ x: m.home.x, y: m.home.y, r: 3 * s }));
    const placed = [];
    const leaders = [];
    const unplaced = [];
    const order = AREAS.map((a, j) => j)
      .filter((j) => inView(P(...BOUNDARY.get(AREAS[j].name).label), 4))
      .sort((x, y) => (y === state.activeArea) - (x === state.activeArea)
        || ringArea(BOUNDARY.get(AREAS[x].name)) - ringArea(BOUNDARY.get(AREAS[y].name)));
    const labelLayer = sv('g', { 'aria-hidden': 'true' });

    for (const j of order) {
      const a = AREAS[j];
      const b = BOUNDARY.get(a.name);
      const anchor = P(...b.label);
      const value = state.valueText(j);
      const variants = [[a.name, value], [a.name]];
      const ownRings = b.polygons.map((poly) => poly.map((ring) => ring.map(([x, y]) => { const q = P(x, y); return [q.x, q.y]; })));
      let best = null;
      for (const lines of variants) {
        const w = (1.04 * Math.max(...lines.map((t, n) => textWidth(t, `${n ? 500 : 650} ${n ? valueFont : nameFont}px ${n ? 'JetBrains Mono' : 'Inter'}`))) + pad * 2) * s;
        const h = (lines.length * lineH + pad * 2 - 3) * s;
        for (const dist of [0, 16, 30, 46, 64, 86, 110, 140, 175]) {
          const angles = dist === 0 ? [0] : Array.from({ length: 24 }, (_, k) => k * 15);
          for (const deg of angles) {
            const rad = (deg * Math.PI) / 180;
            const cx = anchor.x + Math.cos(rad) * dist * s;
            const cy = anchor.y + Math.sin(rad) * dist * s;
            const box = { x: cx - w / 2, y: cy - h / 2, w, h };
            if (box.x < 3 * s || box.y < 3 * s || box.x + w > W - 3 * s || box.y + h > H - 3 * s) continue;
            if (hard.some((r) => rectsOverlap(box, r, 2 * s))) continue;
            if (markerCircles.some((c) => circleRect(c, box, 2 * s))) continue;
            if (pins.some((c) => circleRect(c, box, 1 * s))) continue;
            if (leaders.some(([p, q]) => segmentHitsRect(p, q, box))) continue;
            if (markers.some((m) => segmentHitsRect(m.home, m, box))) continue;
            const leader = !(anchor.x >= box.x && anchor.x <= box.x + w && anchor.y >= box.y && anchor.y <= box.y + h);
            let cost = dist + (lines.length === 1 ? 200 : 0);
            if (leader) {
              const edge = nearestEdge(anchor, box);
              if (placed.some((p) => segmentHitsRect(anchor, edge, p.box))) continue;
              if (leaders.some(([p, q]) => segmentsCross(anchor, edge, p, q))) continue;
              if (markerCircles.some((c) => segmentNearCircle(anchor, edge, c))) cost += 80;
              if (!pointInRings({ x: box.x + w / 2, y: box.y + h / 2 }, ownRings)) cost += 25;
            }
            cost += 12 * dots.filter((d) => circleRect(d, box)).length;
            if (!best || cost < best.cost) best = { box, lines, cost, leader };
          }
          if (best && best.cost < dist + 30) break;
        }
        if (best) break;
      }
      if (!best) { unplaced.push(`${a.name} (${value})`); continue; }
      placed.push(best);
      hard.push(best.box);
      const g = sv('g', { class: 'm-label', 'data-label': a.name });
      if (best.leader) {
        const edge = nearestEdge(anchor, best.box);
        leaders.push([anchor, edge]);
        g.append(sv('line', { class: 'm-leader', x1: anchor.x, y1: anchor.y, x2: edge.x, y2: edge.y, 'stroke-width': 0.9 * s }),
          sv('circle', { class: 'm-pin', cx: anchor.x, cy: anchor.y, r: 2 * s }));
      }
      g.append(sv('rect', { class: 'halo', x: best.box.x, y: best.box.y, width: best.box.w, height: best.box.h, rx: 5 * s, 'stroke-width': 0.6 * s }));
      best.lines.forEach((t, n) => g.append(sv('text', {
        class: n ? 'value' : 'name',
        x: best.box.x + best.box.w / 2,
        y: best.box.y + (pad + 11 + n * lineH) * s,
        'text-anchor': 'middle',
        'font-size': (n ? valueFont : nameFont) * s,
        text: t,
      })));
      labelLayer.append(g);
    }

    svg.append(labelLayer, markerLayer, scale, north, attrib);
    note.hidden = unplaced.length === 0;
    note.textContent = unplaced.length ? `Too small to label at this size: ${unplaced.join(' · ')}. Tap a council for details.` : '';
  }

  return { render, element: frame };
}

function ringArea(b) {
  let total = 0;
  for (const poly of b.polygons) {
    const ring = poly[0];
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
    total += Math.abs(a / 2);
  }
  return total;
}
function segmentsCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}
function nearestEdge(p, r) {
  return { x: Math.max(r.x, Math.min(p.x, r.x + r.w)), y: Math.max(r.y, Math.min(p.y, r.y + r.h)) };
}
function segmentNearCircle(p, q, c) {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((c.x - p.x) * dx + (c.y - p.y) * dy) / len2));
  return Math.hypot(p.x + t * dx - c.x, p.y + t * dy - c.y) < c.r;
}
export const MAP_VIEWS = VIEWS;

// The colour legend that goes under a map.
export function mapLegend(lo, hi, unit, extras = [], palette = 'heat') {
  return el('div', { class: 'map-legend' },
    el('div', { class: 'ramp-wrap' },
      el('span', { class: palette === 'cool' ? 'ramp cool' : 'ramp', 'aria-hidden': 'true' }),
      el('span', { class: 'ramp-ends' }, el('span', { text: lo }), el('span', { text: hi }))),
    el('span', { text: unit }),
    ...extras);
}
