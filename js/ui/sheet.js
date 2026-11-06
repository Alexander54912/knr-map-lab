// sheet.js — шторка: свёрнута (чипсы и первая строка), середина, на весь экран под шапкой.
// Логика жестов перенесена из js/sheet.js основного прототипа.
import { SHEET } from '../config.js';

const ORDER = ['collapsed', 'mid', 'full'];
const SLOP = 6;

let el = null;
let app = null;
let position = 'collapsed';
let currentY = 0;
let drag = null;
const listeners = new Set();

function offsetFor(pos) {
  const height = el.offsetHeight;
  if (pos === 'full') return 0;
  if (pos === 'collapsed') return Math.max(0, height - SHEET.collapsedPx);
  return Math.max(0, height - app.offsetHeight * SHEET.midRatio);
}

function paint(y) {
  currentY = y;
  el.style.transform = `translateY(${y}px)`;
}

function apply(animate) {
  if (animate) {
    el.classList.add('is-animating');
    clearTimeout(apply.timer);
    apply.timer = setTimeout(() => el.classList.remove('is-animating'), SHEET.durationMs + 20);
  }
  paint(offsetFor(position));
  app.dataset.sheet = position;
}

export function setPosition(pos, { animate = true } = {}) {
  const changed = pos !== position;
  position = pos;
  apply(animate);
  if (changed) listeners.forEach((fn) => fn(pos));
}

export const getPosition = () => position;
export const onChange = (fn) => listeners.add(fn);

function snapTarget(y, velocity) {
  const offsets = ORDER.map((p) => ({ p, y: offsetFor(p) }));
  if (Math.abs(velocity) > SHEET.velocityThreshold) {
    const sorted = [...offsets].sort((a, b) => a.y - b.y);
    if (velocity > 0) return (sorted.find((o) => o.y > y + 1) || sorted[sorted.length - 1]).p;
    return ([...sorted].reverse().find((o) => o.y < y - 1) || sorted[0]).p;
  }
  return offsets.reduce((best, o) => (Math.abs(o.y - y) < Math.abs(best.y - y) ? o : best)).p;
}

function beginDrag(clientY) {
  el.classList.remove('is-animating');
  drag = { startY: clientY, startOffset: currentY, lastY: clientY, lastT: performance.now(), v: 0 };
}

function moveDrag(clientY) {
  const now = performance.now();
  const dt = Math.max(1, now - drag.lastT);
  drag.v = 0.7 * ((clientY - drag.lastY) / dt) + 0.3 * drag.v;
  drag.lastY = clientY;
  drag.lastT = now;
  let y = drag.startOffset + (clientY - drag.startY);
  const max = offsetFor('collapsed');
  if (y < 0) y *= 0.25;
  if (y > max) y = max + (y - max) * 0.25;
  paint(y);
}

function endDrag() {
  const target = snapTarget(currentY, drag.v);
  drag = null;
  setPosition(target);
  apply(true);
}

// Мышь и палец за ручку.
function onPointerDown(e) {
  if (!e.target.closest('[data-sheet-drag]') || e.target.closest('button')) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const startY = e.clientY;
  let started = false;
  const move = (ev) => {
    if (!started) {
      if (Math.abs(ev.clientY - startY) < SLOP) return;
      started = true;
      beginDrag(startY);
    }
    moveDrag(ev.clientY);
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (started) endDrag();
    else setPosition(position === 'collapsed' ? 'mid' : 'collapsed');
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

// Палец по списку: на весь экран список скроллится, от верхнего края жест вниз опускает шторку.
function onTouchStart(e) {
  if (e.touches.length !== 1 || e.target.closest('[data-sheet-drag]')) return;
  const scroller = e.target.closest('.list');
  const chips = e.target.closest('.chips');
  if (!scroller && !chips) return;
  const t = e.touches[0];
  const g = { x: t.clientX, y: t.clientY, mode: null };

  const move = (ev) => {
    const p = ev.touches[0];
    const dx = p.clientX - g.x;
    const dy = p.clientY - g.y;
    if (!g.mode) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      if (Math.abs(dx) > Math.abs(dy)) { g.mode = 'native'; return; }
      const atTop = !scroller || scroller.scrollTop <= 0;
      g.mode = position !== 'full' || (atTop && dy > 0) ? 'sheet' : 'native';
      if (g.mode === 'sheet') beginDrag(g.y);
    }
    if (g.mode === 'sheet') {
      ev.preventDefault();
      moveDrag(p.clientY);
    }
  };
  const end = () => {
    el.removeEventListener('touchmove', move);
    el.removeEventListener('touchend', end);
    el.removeEventListener('touchcancel', end);
    if (g.mode === 'sheet') endDrag();
  };
  el.addEventListener('touchmove', move, { passive: false });
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
}

export function initSheet(sheetEl) {
  el = sheetEl;
  app = el.closest('.app');
  apply(false);
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('resize', () => apply(false));
}
