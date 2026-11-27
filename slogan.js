/* Design system — slogan motion
   Close-up camera follows the letters as they are typed, guide lines extend from each one,
   then the camera pulls back to the finished slogan, holds, and loops. Needs slogan-path.js. */
(() => {
  const canvas = document.getElementById('slogan');
  if (!canvas || typeof SLOGAN_PATH === 'undefined') return;
  const ctx = canvas.getContext('2d');

  /* ---------- glyphs from the outline data ---------- */
  const bounds = d => {                       // box of the on-curve points
    let x = 0, y = 0; const b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    (d.match(/[MLHVCZ][^MLHVCZ]*/g) || []).forEach(s => {
      const c = s[0], n = (s.slice(1).match(/-?\d*\.?\d+/g) || []).map(Number);
      const step = { M: 2, L: 2, H: 1, V: 1, C: 6 }[c];
      for (let i = 0; step && i < n.length; i += step) {
        if (c === 'H') x = n[i];
        else if (c === 'V') y = n[i];
        else { x = n[i + step - 2]; y = n[i + step - 1]; }
        b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x);
        b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y);
      }
    });
    return b;
  };
  const inside = (a, b) => a.x0 >= b.x0 - .5 && a.x1 <= b.x1 + .5 && a.y0 >= b.y0 - .5 && a.y1 <= b.y1 + .5;
  const parts = SLOGAN_PATH.split(/(?=M)/).map(d => ({ d, ...bounds(d) }));
  const glyphs = parts.filter(p => !parts.some(q => q !== p && inside(p, q)));
  glyphs.forEach(g => {
    g.path = new Path2D(parts.filter(p => p === g || inside(p, g)).map(p => p.d).join(''));
    g.line = (g.y0 + g.y1) / 2 < 84 ? 0 : 1;
  });
  glyphs.sort((a, b) => a.line - b.line || a.x0 - b.x0);
  const rows = [0, 1].map(i => glyphs.filter(g => g.line === i));
  const metrics = rows.map((r, i) => ({
    cap: r[0].y0, base: r[0].y1,              // F / N
    xh: r[i ? 2 : 6].y0                       // x / u
  }));

  /* ---------- timeline (seconds) ---------- */
  const STEP = .135, SPACE = .11;
  rows[0].forEach((g, i) => g.t = .7 + i * STEP + (i >= 4 ? SPACE : 0));
  rows[1].forEach((g, i) => g.t = 2.35 + i * STEP + (i >= 4 ? SPACE : 0));
  const END = 5.7;                            // finished slogan is fully in place
  const LOOP = 7.6;                           // hold it, fade out, start again

  const clamp = v => Math.min(1, Math.max(0, v));
  const ramp = (t, a, b) => clamp((t - a) / (b - a));
  const ease = {
    sine: p => .5 - Math.cos(Math.PI * p) / 2,
    inOut: p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2,
  };

  /* camera keys: time, centre x, centre y, zoom (1 = whole slogan), easing into this key */
  const F = rows[0][0], N = rows[1][0], mid = i => (metrics[i].cap + metrics[i].base) / 2;
  /* while typing the camera only drifts */
  const CAM = [
    [0,    172,  mid(0),  2.9],
    [.7,   185,  mid(0),  2.65, 'sine'],
    [1.8,  268,  mid(0),  2.4,  'sine'],
    [2.55, 175,  mid(1),  2.4,  'sine'],
    [3.8,  315,  mid(1),  2.3,  'sine'],
    [5.2,  254,  84.5,    1,    'inOut']
  ];
  const camera = t => {
    let i = 1; while (i < CAM.length - 1 && t > CAM[i][0]) i++;
    const a = CAM[i - 1], b = CAM[i], p = ease[b[4]](ramp(t, a[0], b[0]));
    const zoom = k => k[0] < 4 && W < 600 ? k[3] * .7 : k[3];   // narrow cards: stay a bit further out while typing
    return { x: a[1] + (b[1] - a[1]) * p, y: a[2] + (b[2] - a[2]) * p, z: zoom(a) * Math.pow(zoom(b) / zoom(a), p) };
  };

  /* ---------- drawing ---------- */
  let W = 0, H = 0, dpr = 1, fit = 1;
  const LINE = '47,86,214';
  function stroke(x0, y0, x1, y1, alpha) {
    if (alpha <= 0) return;
    ctx.strokeStyle = `rgba(${LINE},${alpha})`;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }

  function draw(t) {
    const cam = camera(t), s = fit * cam.z;
    const sx = x => (x - cam.x) * s + W / 2, sy = y => (y - cam.y) * s + H / 2;
    const world = () => ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * sx(0), dpr * sy(0));
    const screen = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const solid = ease.sine(ramp(t, 4.25, 5.15));        // grey construction fill -> black
    const retract = ease.inOut(ramp(t, 4.5, 5.6));       // guides pull back in

    screen(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

    const shown = glyphs.filter(g => t >= g.t);
    const appear = g => ease.sine(ramp(t, g.t, g.t + .26));   // each letter simply fades in

    shown.forEach(g => {
      world();
      ctx.globalAlpha = appear(g) * (1 - solid); ctx.fillStyle = '#dbe1ea'; ctx.fill(g.path, 'evenodd');
    });
    ctx.globalAlpha = 1;

    /* guide lines: start at their letter and shoot out to the edges of the frame */
    screen(); ctx.lineWidth = 1;
    const fade = 1 - ramp(t, 5.05, 5.6);
    if (fade > 0) {
      metrics.forEach((m, i) => {
        const start = i ? 1.95 : .1, ox = Math.min(W, Math.max(0, sx(rows[i][0].x0)));
        [m.cap, m.base, m.xh].forEach((y, k) => {
          const p = ease.sine(ramp(t, start + k * .12, start + k * .12 + 1.1)) * (1 - retract);
          if (p <= 0) return;
          const py = Math.round(sy(y)) + .5;
          stroke(ox - ox * p, py, ox + (W - ox) * p, py, (k === 2 ? .26 : .4) * fade);
        });
      });
      glyphs.forEach(g => {
        const from = g === F ? .05 : g === N ? 2 : g.t - .06;
        const p = ease.sine(ramp(t, from, from + 1)) * (1 - retract);
        if (p <= 0) return;
        const oy = Math.min(H, Math.max(0, sy((g.y0 + g.y1) / 2)));
        const alpha = .22 * fade;                         // quiet and even, so the letters lead
        [g.x0, g.x1].forEach(x => {
          const px = Math.round(sx(x)) + .5;
          stroke(px, oy - oy * p, px, oy + (H - oy) * p, alpha);
        });
      });
    }

    shown.forEach(g => {
      world();
      const a = appear(g) * (1 - ramp(t, LOOP - .4, LOOP));   // fade out before the loop restarts
      ctx.globalAlpha = a * solid; ctx.fillStyle = '#0d0d0d'; ctx.fill(g.path, 'evenodd');
      ctx.globalAlpha = a * (1 - solid); ctx.strokeStyle = '#0d0d0d'; ctx.lineWidth = 1 / s; ctx.stroke(g.path);
    });
    ctx.globalAlpha = 1;
  }

  /* ---------- loop while on screen ---------- */
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, t0 = 0, playing = false, now = still ? END : 0;
  const tick = ms => {
    if (!t0) t0 = ms;
    now = ((ms - t0) / 1000) % LOOP;
    draw(now);
    raf = requestAnimationFrame(tick);
  };
  new ResizeObserver(() => {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    fit = Math.min(W * (W < 600 ? .7 : .48) / 508, H * .55 / 169);
    draw(now);
  }).observe(canvas);
  if (still) return;
  new IntersectionObserver(es => {
    const e = es[es.length - 1];
    if (e.intersectionRatio >= .35 && !playing) { playing = true; t0 = 0; raf = requestAnimationFrame(tick); }
    else if (!e.isIntersecting) {                        // fully off screen: ready to play again
      cancelAnimationFrame(raf); playing = false; now = 0; draw(0);
    }
  }, { threshold: [0, .35] }).observe(canvas);
})();
