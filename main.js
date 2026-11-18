/* Polaroid campaign site — interactions */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

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
    acceptNode: n => (n.parentElement.closest('script,style,.ko') || !has.test(n.nodeValue))
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

/* hero image settle */
requestAnimationFrame(() => document.querySelector('.hero').classList.add('loaded'));

/* stories: background rectangle grows to full width as the section scrolls in */
(() => {
  const el = document.querySelector('.section--grow');
  if (!el) return;
  let tick = false;
  const upd = () => {
    tick = false;
    const r = el.getBoundingClientRect(), vh = innerHeight;
    // grows as the section scrolls in (full width when its top reaches the top of the screen); stays full once past
    const p = r.bottom <= vh ? 1 : Math.min(1, Math.max(0, (vh * .55 - r.top) / (vh * 1.1)));   // starts once the card is well inside the screen; slow, long scroll distance
    el.style.setProperty('--p', (p * p * (3 - 2 * p)).toFixed(3));   // smoothstep
  };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
  addEventListener('resize', upd);
  upd();
})();
