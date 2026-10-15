// The 3D hero: each council is its real shape, raised by how many people there likely have
// undiagnosed high blood pressure, and coloured by the rate per 1,000 adults.
// Drag to turn it, hover or use the arrow buttons to read a council. Falls back to a flat
// map when WebGL isn't available, and stays still for people who prefer reduced motion.
import * as THREE from '../vendor/three.module.min.js';
import { DATA } from './data.js';
import { AREAS, fmt, round100 } from './model.js';
import { el, sv, heatStep, onThemeChange, reducedMotion } from './ui.js';

const COS0 = Math.cos((-33.8 * Math.PI) / 180);
const BOUNDS = { lon: [150.0, 151.17], lat: [-34.35, -32.98] };
const BOUNDARY = new Map(DATA.boundaries.map((b) => [b.name, b]));

export function mountHero(stage) {
  const readout = stage.querySelector('.hero-readout');
  const title = readout.querySelector('b');
  const detail = readout.querySelector('span');
  const maxHidden = Math.max(...AREAS.map((a) => a.hidden));
  const rates = AREAS.map((a) => a.rate);
  const lo = Math.min(...rates);
  const hi = Math.max(...rates);
  const order = AREAS.map((_, j) => j).sort((x, y) => AREAS[y].hidden - AREAS[x].hidden);

  const describe = (j) => {
    if (j === null) {
      title.textContent = 'Western Sydney, 13 councils';
      detail.textContent = 'Height: people likely undiagnosed. Colour: rate per 1,000 adults.';
      return;
    }
    const a = AREAS[j];
    title.textContent = a.name;
    detail.textContent = `About ${fmt(round100(a.hidden))} people likely undiagnosed · ${a.rate.toFixed(0)} per 1,000 adults`;
  };
  describe(null);

  const canvas = el('canvas', { 'aria-hidden': 'true' });
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) {
    renderer = null;
  }
  if (!renderer) return fallback(stage, describe, lo, hi);
  stage.prepend(canvas);
  stage.dataset.mode = 'webgl';

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  camera.position.set(0, 15.5, 17.5);
  camera.lookAt(0, 0.6, 0.6);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f70, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-6, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.radius = 4;
  scene.add(sun);

  // Map coordinates: 1 unit ≈ 10 km, centred on the region, north pointing away from the viewer.
  const cx = (BOUNDS.lon[0] + BOUNDS.lon[1]) / 2;
  const cy = (BOUNDS.lat[0] + BOUNDS.lat[1]) / 2;
  const X = (lon) => ((lon - cx) * 111.32 * COS0) / 10;
  const Y = (lat) => ((lat - cy) * 110.57) / 10;
  const shapesOf = (polygons) => polygons.map((poly) => {
    const shape = new THREE.Shape(poly[0].map(([x, y]) => new THREE.Vector2(X(x), Y(y))));
    for (const hole of poly.slice(1)) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(X(x), Y(y)))));
    return shape;
  });

  const group = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  scene.add(group);

  const css = () => getComputedStyle(document.documentElement);
  const color = (name) => new THREE.Color(css().getPropertyValue(name).trim() || '#999');

  const groundMat = new THREE.MeshStandardMaterial({ roughness: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(11, 64), groundMat);
  ground.position.z = -0.02;
  ground.receiveShadow = true;
  group.add(ground);

  const neighbourMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  for (const b of DATA.boundaries) {
    if (b.study) continue;
    const geo = new THREE.ExtrudeGeometry(shapesOf(b.polygons), { depth: 0.04, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, neighbourMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  const blocks = AREAS.map((a, j) => {
    const height = 0.15 + (a.hidden / maxHidden) * 2.6;
    const geo = new THREE.ExtrudeGeometry(shapesOf(BOUNDARY.get(a.name).polygons), {
      depth: height, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 1,
    });
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.02 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.j = j;
    mesh.userData.height = height;
    mesh.scale.z = reducedMotion() ? 1 : 0.001;
    group.add(mesh);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 }));
    mesh.add(edges);
    return { mesh, edges, step: heatStep(a.rate, lo, hi) };
  });

  function paint() {
    groundMat.color = color('--sunk');
    neighbourMat.color = color('--land');
    const dark = document.documentElement.getAttribute('data-theme') === 'dark'
      || (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    for (const b of blocks) {
      b.mesh.material.color = color(`--heat-${b.step}`);
      b.edges.material.color = new THREE.Color(dark ? 0x000000 : 0xffffff);
    }
    requestRender();
  }
  onThemeChange.add(() => setTimeout(paint, 0));

  // ---------- interaction ----------
  let hovered = null;
  let pinned = null;
  let spin = 0;
  let dragging = null;
  let userTurn = 0;
  const auto = !reducedMotion();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function highlight(j) {
    blocks.forEach((b, k) => {
      b.mesh.material.emissive = new THREE.Color(k === j ? 0x333333 : 0x000000);
    });
    describe(j);
    requestRender();
  }
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(blocks.map((b) => b.mesh), false)[0];
    return hit ? hit.object.userData.j : null;
  }
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) {
      const dx = e.clientX - dragging.x;
      dragging.x = e.clientX;
      userTurn += dx * 0.008;
      requestRender();
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const j = pick(e);
    if (j !== hovered) {
      hovered = j;
      canvas.style.cursor = j === null ? 'grab' : 'pointer';
      highlight(j ?? pinned);
    }
  });
  canvas.addEventListener('pointerdown', (e) => {
    dragging = { x: e.clientX, start: e.clientX };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', (e) => {
    const moved = dragging ? Math.abs(e.clientX - dragging.start) : 0;
    dragging = null;
    if (moved < 5) {
      pinned = pick(e);
      highlight(pinned);
    }
  });
  canvas.addEventListener('pointerleave', () => { hovered = null; highlight(pinned); });

  // Keyboard and screen reader access: step through councils, largest first.
  const tools = stage.querySelector('.hero-tools');
  let cursor = -1;
  const step = (d) => {
    cursor = (cursor + d + order.length) % order.length;
    pinned = order[cursor];
    highlight(pinned);
  };
  tools.querySelector('[data-step="-1"]').addEventListener('click', () => step(-1));
  tools.querySelector('[data-step="1"]').addEventListener('click', () => step(1));

  // ---------- render loop (only while visible) ----------
  let visible = true;
  let frame = 0;
  let needs = true;
  let grow = reducedMotion() ? 1 : 0;
  const t0 = performance.now();
  function requestRender() {
    needs = true;
    if (!frame && visible) frame = requestAnimationFrame(loop);
  }
  function resize() {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    // Pull the camera back on tall/narrow screens so the whole region stays in view.
    const fit = 1.32 * (camera.aspect < 1 ? 1 / camera.aspect : 1);
    camera.position.set(0, 15.5 * fit, 17.5 * fit);
    camera.lookAt(0, 0, 2.2);
    camera.updateProjectionMatrix();
    requestRender();
  }
  function loop(now) {
    frame = 0;
    if (grow < 1) {
      grow = Math.min(1, (now - t0) / 1600);
      const e = 1 - (1 - grow) ** 3;
      blocks.forEach((b, k) => { b.mesh.scale.z = Math.max(0.001, Math.min(1, e * 1.15 - k * 0.012)); });
      needs = true;
    }
    if (auto && !dragging && hovered === null && pinned === null) { spin += 0.0016; needs = true; }
    group.rotation.z = spin + userTurn;
    if (needs) {
      renderer.render(scene, camera);
      needs = false;
    }
    if (visible && (grow < 1 || (auto && hovered === null && pinned === null))) frame = requestAnimationFrame(loop);
  }
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) requestRender();
  }).observe(stage);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) requestRender();
  });
  canvas.style.cursor = 'grab';
  paint();
  resize();
  return { mode: 'webgl' };
}

// No WebGL: a flat outline map with the same colours, still readable and keyboard friendly.
function fallback(stage, describe, lo, hi) {
  stage.dataset.mode = 'flat';
  const W = 400;
  const kmW = (BOUNDS.lon[1] - BOUNDS.lon[0]) * 111.32 * COS0;
  const kmH = (BOUNDS.lat[1] - BOUNDS.lat[0]) * 110.57;
  const H = (W * kmH) / kmW;
  const P = (x, y) => [((x - BOUNDS.lon[0]) * 111.32 * COS0 * W) / kmW, ((BOUNDS.lat[1] - y) * 110.57 * W) / kmW];
  const d = (polys) => polys.map((poly) => poly.map((ring) => ring.map((pt, i) => (i ? 'L' : 'M') + P(...pt).map((v) => v.toFixed(1)).join(' ')).join('') + 'Z').join('')).join('');
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H.toFixed(0)}`, 'aria-hidden': 'true' });
  for (const b of DATA.boundaries) {
    const j = AREAS.findIndex((a) => a.name === b.name);
    const node = sv('path', { d: d(b.polygons), class: j < 0 ? 'm-neighbour' : `m-area heat-${heatStep(AREAS[j].rate, lo, hi)}` });
    if (j >= 0) node.addEventListener('pointerenter', () => describe(j));
    svg.append(node);
  }
  stage.prepend(el('div', { class: 'fallback' }, svg));
  const tools = stage.querySelector('.hero-tools');
  const order = AREAS.map((_, j) => j).sort((x, y) => AREAS[y].hidden - AREAS[x].hidden);
  let cursor = -1;
  tools.querySelector('[data-step="-1"]').addEventListener('click', () => { cursor = (cursor - 1 + order.length) % order.length; describe(order[cursor]); });
  tools.querySelector('[data-step="1"]').addEventListener('click', () => { cursor = (cursor + 1) % order.length; describe(order[cursor]); });
  return { mode: 'flat' };
}
