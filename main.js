/* Polaroid campaign site — interactions */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* 0. A refresh stays where the reader was: remember the position in this tab and put it back
      (otherwise an address ending in #top or another anchor pulls the page back there) */
(() => {
  const key = 'polaroid:y:' + location.pathname;
  history.scrollRestoration = 'manual';
  let y = 0, held = false, queued = false;
  try { y = +sessionStorage.getItem(key) || 0; } catch (e) {}
  const save = () => { queued = false; if (held) return; try { sessionStorage.setItem(key, Math.round(scrollY)); } catch (e) {} };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(save); } }, { passive: true });
  addEventListener('pagehide', save);
  if (!y) return;
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  held = true;                                        // do not save the jumps made while the page settles
  const go = () => { if (held) scrollTo({ top: y, behavior: 'instant' }); };
  const release = () => { held = false; };
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(n => addEventListener(n, release, { once: true, passive: true }));
  go(); requestAnimationFrame(go);
  addEventListener('load', () => { go(); setTimeout(() => { go(); release(); }, 250); }, { once: true });
})();

/* 1. Rotating word in the slogan */
const words = ['sound', 'energy', 'scent', 'memory', 'light', 'you'];
function rotate(el, list, ms) {
  if (!el) return;
  let i = 0;
  setInterval(() => {
    el.classList.add('out');
    setTimeout(() => { i = (i + 1) % list.length; el.textContent = list[i]; el.classList.remove('out'); }, 350);
  }, ms);
}
rotate($('#swap'), words.slice(0, 5), 2600);
rotate($('#swap2'), ['you', 'us', 'now', 'next'], 2400);

/* 2. Scroll reveal */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: .12 });
$$('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 3) * 80 + 'ms'; io.observe(el); });

/* 3. Nav active state — by chapter (about / plan / concept / design) */
const links = $$('.nav__links a');
const spy = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) links.forEach(a => a.classList.toggle('is-active', a.dataset.ch === e.target.dataset.chapter));
}), { rootMargin: '-45% 0px -50% 0px' });
$$('[data-chapter]').forEach(s => spy.observe(s));

/* 4. Complete the sentence (section removed; kept guarded) */
if ($('#word')) {
const word = $('#word'), pw = $('#printWord'), pc = $('#printCap'), photo = $('#printPhoto');
function render(v) {
  const t = (v || '').trim() || '___';
  pw.textContent = t.toUpperCase() + '.';
  pc.textContent = t.toLowerCase();
  photo.style.setProperty('--rot', (Math.random() * 120 - 60).toFixed(0) + 'deg');
  $$('.chip').forEach(c => c.classList.toggle('is-on', c.dataset.w === t.toLowerCase()));
}
word.addEventListener('input', () => render(word.value));
$('#chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  word.value = b.dataset.w; render(word.value);
});
render(word.value);

}

/* 6. Hangul runs get their own tracking (-2%); Latin text keeps its original spacing */
function wrapKorean(root = document.body) {
  const run = '[㄰-㆏가-힯]+(?:[ ,.·—\\-!?~]*[㄰-㆏가-힯]+)*';
  const has = new RegExp(run), all = new RegExp(run, 'g');
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement.closest('script,style,svg,.ko') || !has.test(n.nodeValue))
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  nodes.forEach(n => {
    all.lastIndex = 0;
    const frag = document.createDocumentFragment(); let last = 0, m;
    while ((m = all.exec(n.nodeValue))) {
      if (m.index > last) frag.append(n.nodeValue.slice(last, m.index));
      const sp = document.createElement('span'); sp.className = 'ko'; sp.textContent = m[0]; frag.append(sp);
      last = m.index + m[0].length;
    }
    if (last < n.nodeValue.length) frag.append(n.nodeValue.slice(last));
    n.replaceWith(frag);
  });
}
wrapKorean();

/* story videos: load when close, loop while on screen, and drive the story's progress bar from the video clock */
$$('.story video').forEach(video => {
  const story = video.closest('.story');
  // shared reel: the backdrop is the same picture, tiny (CSS blurs it up) and darker toward the reply bar
  const bg = story.querySelector('.st-bg'), pen = bg && bg.getContext('2d');
  const backdrop = picture => {
    if (!pen) return;
    pen.drawImage(picture, 0, 0, bg.width, bg.height);
    const shade = pen.createLinearGradient(0, bg.height * .6, 0, bg.height);
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,.45)');
    pen.fillStyle = shade; pen.fillRect(0, 0, bg.width, bg.height);
  };
  new IntersectionObserver((es, o) => {
    if (!es.some(e => e.isIntersecting)) return;
    video.poster = video.dataset.poster; o.disconnect();
    if (pen) { const still = new Image(); still.onload = () => { if (!video.currentTime) backdrop(still); }; still.src = video.dataset.poster; }
  }, { rootMargin: '600px 0px' }).observe(video);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bar = story.querySelector('.ig-play');
  const end = +story.dataset.end || 0;  // seconds before the end when the title gives way to the logo
  const clock = story.querySelector('.st-time');  // shared reel card: time left, as in the app
  let raf = 0, drawn = -1;
  const tick = () => {
    if (pen && video.readyState >= 2 && video.currentTime !== drawn) { drawn = video.currentTime; backdrop(video); }
    if (video.duration) {
      bar.style.transform = `scaleX(${video.currentTime / video.duration})`;
      if (end) story.classList.toggle('is-end', video.currentTime >= video.duration - end);
      if (clock) {
        const left = `0:${String(Math.max(0, Math.ceil(video.duration - video.currentTime - .01))).padStart(2, '0')}`;
        if (clock.textContent !== left) clock.textContent = left;
      }
    }
    raf = requestAnimationFrame(tick);
  };
  if (bar) bar.style.animation = 'none';
  new IntersectionObserver(es => {
    cancelAnimationFrame(raf);
    if (es[es.length - 1].isIntersecting) { video.play().catch(() => {}); if (bar) tick(); }
    else video.pause();
  }, { threshold: .15 }).observe(video);
});

/* shared reel in the first story: a tap (picture or "전체 릴스 보기") shows the "릴스 보기" bubble for a moment */
$$('.story--reel').forEach(story => {
  const tip = story.querySelector('.st-tip');
  let timer = 0;
  const hide = () => { story.classList.remove('is-tip'); tip.setAttribute('tabindex', '-1'); };
  const show = () => {
    story.classList.add('is-tip'); tip.setAttribute('tabindex', '0');
    clearTimeout(timer); timer = setTimeout(hide, 2600);
  };
  story.addEventListener('click', show);
  story.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); } });
});

/* feed strip: the posts creep to the left, then snap one place on (measured from the reference: 2.1s a post,
   exponential in and out on top of a slow steady drift); loops forever, only while on screen */
$$('.strip').forEach(strip => {
  const posts = $$('img', strip), n = posts.length;
  const STEP = 2.1, DRIFT = .07;                      // seconds per post; share of the way covered by the slow creep
  const expo = p => p <= 0 ? 0 : p >= 1 ? 1 : p < .5 ? 2 ** (20 * p - 10) / 2 : (2 - 2 ** (10 - 20 * p)) / 2;
  const ease = p => (1 - DRIFT) * expo(p) + DRIFT * p;
  const probe = document.createElement('i'); probe.className = 'strip__gap'; strip.appendChild(probe);
  let at = 0, time = 0, last = 0, raf = 0;
  const layout = () => {
    const step = posts[0].offsetWidth + probe.offsetWidth;
    posts.forEach((img, i) => {
      const d = ((i - at) % n + n * 1.5) % n - n / 2; // shortest way round the ring: the wrap happens far off screen
      img.style.transform = `translateX(calc(-50% + ${(d * step).toFixed(2)}px))`;
    });
  };
  new ResizeObserver(layout).observe(strip);
  new IntersectionObserver((es, o) => {
    if (es.some(e => e.isIntersecting)) { posts.forEach(i => i.loading = 'eager'); o.disconnect(); }
  }, { rootMargin: '800px 0px' }).observe(strip);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const tick = ms => {
    time += last ? Math.min(.1, (ms - last) / 1000) : 0; last = ms;
    const k = Math.floor(time / STEP), f = time / STEP - k;
    at = (k + ease(f)) % n; layout();
    raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(es => {
    cancelAnimationFrame(raf); last = 0;
    if (es[es.length - 1].isIntersecting) raf = requestAnimationFrame(tick);
  }, { threshold: .1 }).observe(strip);
});
