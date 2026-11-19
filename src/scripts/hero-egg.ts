/**
 * Œuf de phénix : dissolution en sable doré, spirale, reconstruction.
 * Cycle de 12 s. L'image <img class="hero-egg"> reste l'œuf réel aux phases
 * immobiles (0–20 % et 95–100 %) : la boucle est donc identique au pixel près.
 */
const CYCLE_MS = 12000;
const HOLD_START = 0.2; // fin de l'immobilité initiale
const DISSOLVE_END = 0.5; // fin de la dissolution
const SWIRL_END = 0.7; // fin de la spirale
const REBUILD_END = 0.95; // fin de la reconstruction
const SPREAD = 0.32; // part d'une phase pendant laquelle un grain voyage
const FADE = 0.22; // durée du fondu de la céramique sous le front
const CURL = 0.9; // courbure des trajectoires (radians)

// ivoire, or pâle, or, or profond, bleu du phénix (atténué)
const PALETTE: [number, number, number][] = [
  [238, 224, 192],
  [216, 186, 122],
  [182, 146, 88],
  [150, 118, 62],
  [92, 112, 152],
];
const ALPHAS = [0.92, 0.6];
const BIN_COUNT = PALETTE.length * ALPHAS.length;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(x));

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function initHeroEgg() {
  const canvas = document.querySelector<HTMLCanvasElement>('.hero-egg-canvas');
  const egg = document.querySelector<HTMLImageElement>('.hero-egg');
  const hero = canvas?.parentElement;
  if (!canvas || !egg || !hero) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
  const ctx = canvas.getContext('2d');
  const layer = document.createElement('canvas');
  const lctx = layer.getContext('2d');
  if (!ctx || !lctx) return;

  if (!(egg.complete && egg.naturalWidth)) {
    await new Promise<void>((resolve) => egg.addEventListener('load', () => resolve(), { once: true }));
  }
  try { await egg.decode(); } catch { /* l'image est déjà utilisable */ }

  // ---------- échantillonnage de l'œuf en grains ----------
  const sw = 260;
  const sh = Math.round((sw * egg.naturalHeight) / egg.naturalWidth);
  const sampler = document.createElement('canvas');
  sampler.width = sw; sampler.height = sh;
  const sctx = sampler.getContext('2d', { willReadFrequently: true });
  if (!sctx) return;
  let data: Uint8ClampedArray;
  try {
    sctx.drawImage(egg, 0, 0, sw, sh);
    data = sctx.getImageData(0, 0, sw, sh).data;
  } catch { return; }

  let top = sh, bottom = 0;
  const opaque: number[] = [];
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (data[(y * sw + x) * 4 + 3] > 60) {
        opaque.push(y * sw + x);
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (opaque.length < 500) return;
  const span = bottom - top + 1;
  const vTop = top / sh; // haut de l'œuf, en fraction de l'image
  const vSpan = span / sh;

  // Plus dense, plus « poussière magique » (ordis récents)
  const count = innerWidth < 700 ? 9000 : 20000;
  const rnd = mulberry32(7);
  type Grain = { u: number; v: number; vn: number; jit: number; th: number; rx: number; ry: number; cT: number; sT: number; om: number; oy: number; size: number; ph: number; bin: number };
  const grains: Grain[] = [];
  for (let i = 0; i < count; i++) {
    const idx = opaque[(rnd() * opaque.length) | 0];
    const px = idx % sw, py = (idx / sw) | 0;
    const o = idx * 4;
    const bluish = data[o + 2] > data[o] + 40 && rnd() < 0.6;
    const pick = rnd();
    const colour = bluish ? 4 : pick < 0.3 ? 0 : pick < 0.6 ? 1 : pick < 0.88 ? 2 : 3;
    const rho = Math.pow(rnd(), 1.15);
    const rx = 0.2 + 0.6 * rho; // rayon d'orbite, en hauteurs d'œuf : dense près de l'œuf, plus clairsemé au large
    const tilt = (rnd() - 0.5) * 0.9;
    const v = (py + rnd()) / sh;
    grains.push({
      u: (px + rnd()) / sw,
      v,
      vn: clamp((py - top) / span),
      jit: (rnd() - 0.5) * 0.1,
      th: rnd() * Math.PI * 2,
      rx,
      ry: rx * (0.5 + 0.35 * rnd()),
      cT: Math.cos(tilt),
      sT: Math.sin(tilt),
      om: (0.95 - 0.5 * rho) * (0.7 + 0.6 * rnd()),
      oy: (v - 0.5) * 0.35,
      size: 0.9 + Math.pow(rnd(), 2) * 1.5,
      ph: rnd() * Math.PI * 2,
      bin: colour * ALPHAS.length + (rnd() < 0.6 ? 0 : 1),
    });
  }
  grains.sort((a, b) => a.bin - b.bin);
  const n = grains.length;
  const G = {
    u: new Float32Array(n), v: new Float32Array(n), vn: new Float32Array(n), jit: new Float32Array(n),
    th: new Float32Array(n), rx: new Float32Array(n), ry: new Float32Array(n), cT: new Float32Array(n),
    sT: new Float32Array(n), om: new Float32Array(n), oy: new Float32Array(n), size: new Float32Array(n), ph: new Float32Array(n),
  };
  const binStart = new Int32Array(BIN_COUNT + 1);
  grains.forEach((g, i) => {
    (Object.keys(G) as (keyof typeof G)[]).forEach((k) => { G[k][i] = g[k]; });
    binStart[g.bin + 1]++;
  });
  for (let b = 0; b < BIN_COUNT; b++) binStart[b + 1] += binStart[b];
  const binStyle = Array.from({ length: BIN_COUNT }, (_, b) => {
    const [r, g, bl] = PALETTE[(b / ALPHAS.length) | 0];
    return `rgb(${r} ${g} ${bl})`;
  });

  // ---------- mise en page ----------
  let dpr = 1, cw = 0, ch = 0, ex = 0, ey = 0, ew = 0, eh = 0, radScale = 1;
  function layout() {
    const hr = hero!.getBoundingClientRect();
    const er = egg!.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = hr.width; ch = hr.height;
    canvas!.width = Math.round(cw * dpr);
    canvas!.height = Math.round(ch * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ex = er.left - hr.left; ey = er.top - hr.top; ew = er.width; eh = er.height;
    layer.width = Math.max(1, Math.round(ew * dpr));
    layer.height = Math.max(1, Math.round(eh * dpr));
    radScale = Math.min(1, (cw * 0.46) / eh);
  }
  layout();
  new ResizeObserver(layout).observe(hero);

  // ---------- rendu ----------
  let shown = false;
  function setStatic() {
    if (!shown) return;
    ctx!.clearRect(0, 0, cw, ch);
    egg!.style.opacity = '1';
    shown = false;
  }

  function maskedEgg(v0: number, v1: number) {
    const lw = layer.width, lh = layer.height;
    lctx!.globalCompositeOperation = 'source-over';
    lctx!.clearRect(0, 0, lw, lh);
    lctx!.drawImage(egg!, 0, 0, lw, lh);
    const y0 = (vTop + v0 * vSpan) * lh;
    const y1 = (vTop + v1 * vSpan) * lh;
    const grad = lctx!.createLinearGradient(0, y0, 0, y1);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    lctx!.globalCompositeOperation = 'destination-in';
    lctx!.fillStyle = grad;
    lctx!.fillRect(0, 0, lw, lh);
    ctx!.drawImage(layer, ex, ey, ew, eh);
  }

  function render(t: number) {
    if (t < HOLD_START || t >= REBUILD_END) { setStatic(); return; }
    if (!shown) { egg!.style.opacity = '0'; shown = true; }
    ctx!.clearRect(0, 0, cw, ch);

    let mode: 0 | 1 | 2, k: number;
    if (t < DISSOLVE_END) { mode = 0; k = ease((t - HOLD_START) / (DISSOLVE_END - HOLD_START)); }
    else if (t < SWIRL_END) { mode = 1; k = 1; }
    else { mode = 2; k = ease((t - SWIRL_END) / (REBUILD_END - SWIRL_END)); }

    // l'œuf, de haut en bas à la dissolution, de bas en haut à la reconstruction
    if (mode === 0) {
      const v1 = k / (1 - SPREAD);
      maskedEgg(v1 - FADE / (1 - SPREAD), v1);
    } else if (mode === 2) {
      const v1 = 1 - (k - SPREAD) / (1 - SPREAD);
      maskedEgg(v1 - FADE / (1 - SPREAD), v1);
    }

    const cx = ex + ew / 2, cy = ey + eh / 2, H = eh * radScale, Hy = eh;
    const tau = ((t - HOLD_START) * CYCLE_MS) / 1000;
    for (let b = 0; b < BIN_COUNT; b++) {
      ctx!.fillStyle = binStyle[b];
      ctx!.globalAlpha = ALPHAS[b % ALPHAS.length];
      for (let i = binStart[b]; i < binStart[b + 1]; i++) {
        let s: number;
        if (mode === 0) {
          const u = (k - clamp(G.vn[i] + G.jit[i]) * (1 - SPREAD)) / SPREAD;
          if (u <= 0) continue;
          s = ease(u);
        } else if (mode === 1) {
          s = 1;
        } else {
          const w = (k - clamp(1 - G.vn[i] + G.jit[i]) * (1 - SPREAD)) / SPREAD;
          if (w >= 1) continue;
          s = 1 - ease(w);
        }
        const hx = ex + G.u[i] * ew, hy = ey + G.v[i] * eh;
        const ang = G.th[i] + tau * G.om[i]; // sens horaire à l'écran (y vers le bas)
        const lx = G.rx[i] * H * Math.cos(ang), ly = G.ry[i] * H * Math.sin(ang);
        const wob = 0.012 * Hy * Math.sin(tau * 1.1 + G.ph[i]);
        const X = cx + lx * G.cT[i] - ly * G.sT[i] + wob;
        const Y = cy + G.oy[i] * Hy + lx * G.sT[i] + ly * G.cT[i] + wob;
        let dx = X - hx, dy = Y - hy;
        if (s > 0 && s < 1) {
          const a = CURL * Math.sin(Math.PI * s);
          const ca = Math.cos(a), sa = Math.sin(a);
          const rx = dx * ca - dy * sa;
          dy = dx * sa + dy * ca; dx = rx;
        }
        const sz = G.size[i];
        ctx!.fillRect(hx + dx * s - sz / 2, hy + dy * s - sz / 2, sz, sz);
      }
    }
    ctx!.globalAlpha = 1;
  }

  // ---------- boucle ----------
  let raf = 0, visible = true;
  const t0 = performance.now();
  function frame(now: number) {
    raf = 0;
    if (!visible) return;
    render(((now - t0) % CYCLE_MS) / CYCLE_MS);
    raf = requestAnimationFrame(frame);
  }
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(frame);
    if (!visible) setStatic();
  }).observe(hero);
  raf = requestAnimationFrame(frame);
}
