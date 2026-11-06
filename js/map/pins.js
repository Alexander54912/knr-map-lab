// pins.js — маркеры на карте. Кэш по id: живой маркер только меняет вид, поэтому карта не мигает.
/* global maplibregl */
import { escapeHtml, percent } from '../ui/dom.js';
import { logoInner, merchantColor } from '../ui/icons.js';

const Z_ORDER = { dot: 1, logo: 2, cluster: 2, mini: 3, pill: 3, rest: 4, selected: 5 };
const GLIDE_MS = 340;

// Плавно перевести маркер из одной точки в другую.
function glide(marker, from, to, done) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { marker.setLngLat(to); done?.(); return; }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / GLIDE_MS);
    const k = 1 - (1 - t) ** 3;
    marker.setLngLat([from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k]);
    if (t < 1) requestAnimationFrame(step);
    else done?.();
  };
  marker.setLngLat(from);
  requestAnimationFrame(step);
}

// Где сейчас стоят точки кластеров: id точки → координаты кластера.
function homesOf(clusters) {
  const homes = new Map();
  for (const c of clusters) c.ids.forEach((id) => homes.set(id, [c.lon, c.lat]));
  return homes;
}

const pointIds = (item) => (item.kind === 'cluster' ? item.ids : [item.id]);
const homeOf = (item, homes) => pointIds(item).map((id) => homes.get(id)).find(Boolean);

export class PinLayer {
  constructor(map, { onOfferTap, onClusterTap, animate = false }) {
    this.map = map;
    this.onOfferTap = onOfferTap;
    this.onClusterTap = onClusterTap;
    this.animate = animate;
    this.live = new Map();   // id → { marker, el, tier, item }
  }

  // items: [{ id, kind: 'offer'|'cluster', lat, lon, tier, rank, point?, count?, ids? }]
  render(items) {
    const before = this.animate ? homesOf([...this.live.values()].map((e) => e.item).filter((i) => i.kind === 'cluster')) : null;
    const after = this.animate ? homesOf(items.filter((i) => i.kind === 'cluster')) : null;
    const seen = new Set();
    items.forEach((item) => {
      seen.add(item.id);
      const entry = this.live.get(item.id) || this.create(item, before);
      this.update(entry, item);
    });
    for (const [id, entry] of this.live) {
      if (!seen.has(id)) this.remove(id, entry, after);
    }
  }

  create(item, before) {
    const el = document.createElement('div');
    el.className = 'mk';
    el.innerHTML = item.kind === 'cluster' ? '<span class="clu"></span>' : offerHtml(item.point.merchant);
    const entry = { el, tier: null, item };
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (entry.item.kind === 'cluster') this.onClusterTap(entry.item);
      else this.onOfferTap(entry.item.id);
    });
    const target = [item.lon, item.lat];
    entry.marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(target).addTo(this.map);
    this.live.set(item.id, entry);
    requestAnimationFrame(() => el.classList.add('is-in'));
    // Разлёт: новая точка выходит из кластера, в котором была.
    const from = before && homeOf(item, before);
    if (from) glide(entry.marker, from, target);
    return entry;
  }

  update(entry, item) {
    const { el } = entry;
    entry.item = item;
    if (item.kind === 'cluster') {
      el.firstElementChild.textContent = item.rest ? `+${item.count}` : (item.count > 99 ? '99+' : item.count);
      el.classList.toggle('mk--rest', Boolean(item.rest));
      el.classList.toggle('mk--attached', Boolean(item.attached));
    }
    if (entry.tier !== item.tier) {
      el.dataset.tier = item.tier;
      entry.tier = item.tier;
    }
    el.dataset.kind = item.kind;
    el.classList.toggle('is-selected', Boolean(item.selected));
    let level = Z_ORDER[item.tier];
    if (item.rest) level = Z_ORDER.rest;
    if (item.selected) level = Z_ORDER.selected;
    el.style.zIndex = level * 10000 + (item.rank || 0);
  }

  remove(id, entry, after) {
    this.live.delete(id);
    // Сбор: точка уходит в кластер, который её принял.
    const to = after && homeOf(entry.item, after);
    if (to) {
      glide(entry.marker, entry.marker.getLngLat().toArray(), to, () => entry.marker.remove());
      return;
    }
    entry.el.classList.remove('is-in');
    setTimeout(() => entry.marker.remove(), 160);
  }
}

function offerHtml(merchant) {
  return `<span class="pin">
    <span class="pin__body">
      <b>${escapeHtml(merchant.name)}</b>
      <i>${escapeHtml(merchant.benefit)}</i>
    </span>
    <span class="pin__pct">${percent(merchant)}</span>
    <span class="pin__logo" style="background:${merchantColor(merchant)}">${logoInner(merchant)}</span>
  </span>`;
}
