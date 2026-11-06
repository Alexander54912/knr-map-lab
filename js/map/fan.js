// fan.js — веер: партнёры кластера расходятся вокруг него по кругу, карта не приближается.
/* global maplibregl */
import { getPoint } from '../core/api.js';
import { percent } from '../ui/dom.js';
import { logoInner, merchantColor } from '../ui/icons.js';

const STEP_PT = 50;       // расстояние между соседними пинами по кругу
const MIN_RADIUS = 66;

let current = null;

export function closeFan() {
  if (!current) return;
  const { marker, el } = current;
  current = null;
  el.classList.remove('is-open');
  setTimeout(() => marker.remove(), 200);
}

export const isFanOpen = () => Boolean(current);

export function openFan(map, cluster, onPick) {
  closeFan();
  const points = cluster.ids.map(getPoint).sort((a, b) => b.weight - a.weight);
  const radius = Math.max(MIN_RADIUS, (points.length * STEP_PT) / (2 * Math.PI));
  const places = points.map((point, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / points.length;
    return { point, x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) };
  });

  const el = document.createElement('div');
  el.className = 'fan';
  el.style.setProperty('--r', `${radius + 44}px`);
  el.innerHTML = `<span class="fan__bg"></span>
    <svg class="fan__lines" viewBox="-200 -200 400 400">${places.map((p) => `<line x1="0" y1="0" x2="${p.x}" y2="${p.y}"/>`).join('')}</svg>
    ${places.map(({ point, x, y }) => `<button class="fan__pin" type="button" data-id="${point.id}" style="--x:${x}px;--y:${y}px">
      <span class="pin__logo" style="background:${merchantColor(point.merchant)}">${logoInner(point.merchant)}</span>
      <b>${percent(point.merchant)}</b>
    </button>`).join('')}`;
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const pin = e.target.closest('.fan__pin');
    closeFan();
    if (pin) onPick(getPoint(pin.dataset.id));
  });

  const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([cluster.lon, cluster.lat]).addTo(map);
  el.style.zIndex = 90000;
  current = { marker, el };
  requestAnimationFrame(() => el.classList.add('is-open'));
}
