/* Design system — slogan motion, after a logo-motion reference:
   finished slogan with a grid shooting out of the letters, a hard cut into the outlines (anchor points and
   guides, the camera snapping from letter to letter while the points settle into place), then a hard cut
   back where it is typed again with a short scale punch and the grid is drawn back in. Needs slogan-path.js. */
(() => {
  const canvas = document.getElementById('slogan');
  if (!canvas || typeof SLOGAN_PATH === 'undefined') return;
  const ctx = canvas.getContext('2d');

  /* ---------- glyphs from the outline data, kept as editable points ---------- */
  const contours = SLOGAN_PATH.split(/(?=M)/).map(d => {
    let x = 0, y = 0, start = null; const segs = [];
    (d.match(/[MLHVCZ][^MLHVCZ]*/g) || []).forEach(s => {
      const c = s[0], n = (s.slice(1).match(/-?\d*\.?\d+/g) || []).map(Number);
      const step = { M: 2, L: 2, H: 1, V: 1, C: 6 }[c];
      for (let i = 0; step && i < n.length; i += step) {
        if (c === 'C') { segs.push([n[i], n[i + 1], n[i + 2], n[i + 3], n[i + 4], n[i + 5]]); x = n[i + 4]; y = n[i + 5]; continue; }
        if (c === 'H') x = n[i]; else if (c === 'V') y = n[i]; else { x = n[i]; y = n[i + 1]; }
        if (c === 'M' && i === 0) start = [x, y]; else segs.push([x, y]);
      }
    });
    // nodes = on-curve points; a closing point that repeats the start is the same node
    const last = segs[segs.length - 1], end = last.slice(-2);
    if (Math.hypot(end[0] - start[0], end[1] - start[1]) > .05) segs.push([start[0], start[1]]);
    const nodes = [start, ...segs.slice(0, -1).map(g => g.slice(-2))];
    const xs = nodes.map(p => p[0]), ys = nodes.map(p => p[1]);
    return { start, segs, nodes, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
  const inside = (a, b) => a.x0 >= b.x0 - .5 && a.x1 <= b.x1 + .5 && a.y0 >= b.y0 - .5 && a.y1 <= b.y1 + .5;
  const glyphs = contours.filter(p => !contours.some(q => q !== p && inside(p, q)))
    .map(p => ({ x0: p.x0, x1: p.x1, y0: p.y0, y1: p.y1, line: (p.y0 + p.y1) / 2 < 84 ? 0 : 1, parts: contours.filter(c => c === p || inside(c, p)) }));
  glyphs.sort((a, b) => a.line - b.line || a.x0 - b.x0);
  const rows = [0, 1].map(i => glyphs.filter(g => g.line === i));
  const mid = i => (rows[i][0].y0 + rows[i][0].y1) / 2;      // F / N
  const box = { x: (Math.min(...glyphs.map(g => g.x0)) + Math.max(...glyphs.map(g => g.x1))) / 2, y: (Math.min(...glyphs.map(g => g.y0)) + Math.max(...glyphs.map(g => g.y1))) / 2 };

  /* ---------- timeline (seconds) ---------- */
  const N = glyphs.length;
  const CUT_IN = 2.1;                              // into the outlines
  const CUT_OUT = CUT_IN + 3.5;                    // back to the slogan
  const BACK_STEP = .048;
  const LOOP = CUT_OUT + 3.1;                      // ends as it begins, so the loop has no seam

  const clamp = v => Math.min(1, Math.max(0, v));
  const ramp = (t, a, b) => clamp((t - a) / (b - a));
  const snap = p => p < .5 ? 16 * p ** 5 : 1 - (-2 * p + 2) ** 5 / 2;   // slow, very fast, slow
  const out = p => 1 - (1 - p) ** 4;

  const typed = t => t >= CUT_OUT ? Math.min(N, 1 + Math.floor((t - CUT_OUT) / BACK_STEP)) : N;

  /* close-up stations: Fe, Yo, Ne, Ph; the camera snaps from one to the next */
  const station = (i, line) => ({ x: (glyphs[i].x0 + glyphs[i + 1].x1) / 2, y: mid(line), glyphs: [glyphs[i], glyphs[i + 1]] });
  const STOPS = [station(0, 0), station(4, 0), station(8, 1), station(12, 1)];
  const MOVES = [[.6, 1.35], [1.5, 2.25], [2.4, 3.15]];       // seconds after CUT_IN
  const camera = u => {
    let x = STOPS[0].x - 6 + 6 * ramp(u, 0, MOVES[0][0]), y = STOPS[0].y;
    MOVES.forEach(([a, b], i) => { const p = snap(ramp(u, a, b)); x += (STOPS[i + 1].x - STOPS[i].x) * p; y += (STOPS[i + 1].y - STOPS[i].y) * p; });
    return { x: x + u * 1.6, y };                              // a constant slow drift on top
  };
  /* some points of each station start out of place and settle as the camera arrives */
  const SHIFT = [[7, -5], [-9, 0], [0, 8], [6, 6], [-5, -7]];
  const offsets = new Map();
  STOPS.forEach((s, k) => s.glyphs.forEach((g, j) => g.parts.forEach((c, ci) => c.nodes.forEach((_, n) => {
    if ((n + ci + j) % 3 !== 1) return;
    const arrive = k ? MOVES[k - 1] : [.05, .75];
    offsets.set(c.nodes[n], { d: SHIFT[(n + k + j) % SHIFT.length], a: arrive[0] + .12, b: arrive[1] + .12 });
  }))));

  /* a contour with its points moved for time u (u < 0: exact shape); handles travel with their point */
  const shape = (c, u) => {
    const delta = i => {
      const o = u >= 0 && offsets.get(c.nodes[i % c.nodes.length]);
      if (!o) return [0, 0];
      const m = 1 - snap(ramp(u, o.a, o.b));
      return [o.d[0] * m, o.d[1] * m];
    };
    const move = (x, y, d) => [x + d[0], y + d[1]];
    const nodes = c.nodes.map((p, i) => move(p[0], p[1], delta(i)));
    const segs = c.segs.map((g, i) => g.length === 2
      ? move(g[0], g[1], delta(i + 1))
      : [...move(g[0], g[1], delta(i)), ...move(g[2], g[3], delta(i + 1)), ...move(g[4], g[5], delta(i + 1))]);
    return { start: nodes[0], nodes, segs };
  };
  const trace = (path, s) => {
    path.moveTo(...s.start);
    s.segs.forEach(g => g.length === 2 ? path.lineTo(...g) : path.bezierCurveTo(...g));
    path.closePath();
  };
  glyphs.forEach(g => { g.path = new Path2D(); g.parts.forEach(c => trace(g.path, shape(c, -1))); });

  /* grid on the whole-slogan view: cap and base line of both rows, and both sides of every letter (the spacing) */
  const metrics = [0, 1].map(i => { const r = glyphs.filter(g => g.line === i); return { x: r[0].x0, lines: [r[0].y0, r[0].y1] }; });   // F / N
  const split = (Math.max(...rows[0].map(g => g.y1)) + Math.min(...rows[1].map(g => g.y0))) / 2;   // between the two rows
  const ioCubic = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const grow = p => .5 - Math.cos(Math.PI * p) / 2;

  /* ---------- drawing ---------- */
  let W = 0, H = 0, dpr = 1, fit = 1, near = 1;
  const BG = '#000', INK = '#f3f3ec', BODY = '#131313', EDGE = '#505050', GUIDE = 'rgba(255,255,255,.13)', NODE = '#b9bbb1';
  const screen = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  /* lines start at their letter and shoot out to the edges; at the end they are drawn back in */
  function grid(t, s) {
    const back = t >= CUT_OUT, t0 = back ? CUT_OUT : 0;
    const away = back ? ioCubic(ramp(t, CUT_OUT + 1.55, CUT_OUT + 2.65)) : 0;
    if (away >= 1) return;
    const fade = 1 - ramp(away, .6, 1);
    const sx = x => (x - box.x) * s + W / 2, sy = y => (y - box.y) * s + H / 2;
    const stroke = (x0, y0, x1, y1, alpha) => { ctx.strokeStyle = `rgba(255,255,255,${alpha * fade})`; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
    screen(); ctx.lineWidth = 1;
    metrics.forEach((m, i) => {
      const ox = Math.min(W, Math.max(0, sx(m.x)));
      m.lines.forEach((y, k) => {
        const from = t0 + .1 + i * .22 + k * .1, p = grow(ramp(t, from, from + (back ? .7 : 1))) * (1 - away);
        if (p <= 0) return;
        const py = Math.round(sy(y)) + .5;
        stroke(ox - ox * p, py, ox + (W - ox) * p, py, .26);
      });
    });
    glyphs.forEach((g, n) => {
      const from = back ? t0 + n * BACK_STEP : .15 + n * .035, p = grow(ramp(t, from, from + (back ? .6 : .9))) * (1 - away);
      if (p <= 0) return;
      const oy = sy((g.y0 + g.y1) / 2), top = g.line ? sy(split) : 0, end = g.line ? H : sy(split);   // own half only
      [g.x0, g.x1].forEach(x => { const px = Math.round(sx(x)) + .5; stroke(px, oy - (oy - top) * p, px, oy + (end - oy) * p, .16); });
    });
  }

  function flat(t) {                                       // the slogan as it reads
    const n = typed(t), s = fit * (t >= CUT_OUT ? 1 + .42 * (1 - out(ramp(t, CUT_OUT, CUT_OUT + .6))) : 1);
    grid(t, s);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - box.x * s), dpr * (H / 2 - box.y * s));
    ctx.fillStyle = INK;
    for (let i = 0; i < n; i++) ctx.fill(glyphs[i].path, 'evenodd');
  }

  function outlines(u) {                                   // the close-up
    const cam = camera(u), s = near;
    const sx = x => (x - cam.x) * s + W / 2, sy = y => (y - cam.y) * s + H / 2;
    const seen = glyphs.filter(g => sx(g.x1) > -80 && sx(g.x0) < W + 80 && sy(g.y1) > -80 && sy(g.y0) < H + 80);
    const shapes = seen.map(g => g.parts.map(c => shape(c, u)));
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * sx(0), dpr * sy(0));
    shapes.forEach(parts => {
      const p = new Path2D(); parts.forEach(c => trace(p, c));
      ctx.fillStyle = BODY; ctx.fill(p, 'evenodd');
      ctx.strokeStyle = EDGE; ctx.lineWidth = 1.1 / s; ctx.stroke(p);
    });
    /* guides: every straight stem and bar carries on to the edge of the frame */
    screen();
    const xs = new Set(), ys = new Set();
    shapes.forEach(parts => parts.forEach(c => c.segs.forEach((g, i) => {
      if (g.length !== 2) return;
      const a = c.nodes[i], b = g;
      if (Math.abs(a[0] - b[0]) < .1 && Math.abs(a[1] - b[1]) > 8) xs.add(Math.round(sx(a[0])) + .5);
      if (Math.abs(a[1] - b[1]) < .1 && Math.abs(a[0] - b[0]) > 8) ys.add(Math.round(sy(a[1])) + .5);
    })));
    ctx.strokeStyle = GUIDE; ctx.lineWidth = 1; ctx.beginPath();
    xs.forEach(x => { ctx.moveTo(x, 0); ctx.lineTo(x, H); });
    ys.forEach(y => { ctx.moveTo(0, y); ctx.lineTo(W, y); });
    ctx.stroke();
    const d = W < 600 ? 5 : 7;
    ctx.fillStyle = NODE;
    shapes.forEach(parts => parts.forEach(c => c.nodes.forEach(p => ctx.fillRect(sx(p[0]) - d / 2, sy(p[1]) - d / 2, d, d))));
  }

  function draw(t) {
    screen(); ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    if (t >= CUT_IN && t < CUT_OUT) outlines(t - CUT_IN); else flat(t);
  }

  /* ---------- loop while on screen ---------- */
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, t0 = 0, playing = false, now = 0;
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
    fit = Math.min(W * (W < 600 ? .72 : .42) / 508, H * .55 / 169);
    near = Math.min(H * 1.15 / 70.7, W / 92);              // letters taller than the frame
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
