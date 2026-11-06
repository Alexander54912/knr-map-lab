// menu.js — список вариантов и капсула для переключения на том же месте карты.
import { VARIANT_ORDER, VARIANTS } from '../config.js';
import { escapeHtml } from './dom.js';
import { ICONS } from './icons.js';

const label = (variant) => (/^\d+$/.test(variant.id) ? `${variant.id}. ${variant.title}` : variant.title);

export function renderMenu(root) {
  root.innerHTML = `<div class="menu">
    <h1>Карта «Кэшбэк на районе»</h1>
    <p>Варианты тайлов и кластеров. Внутри можно листать варианты стрелками: карта останется на том же месте.</p>
    ${VARIANT_ORDER.map((id) => {
      const v = VARIANTS[id];
      return `<a class="menu__row" href="?v=${id}&nav=1"><b>${escapeHtml(label(v))}</b><span>${escapeHtml(v.note)}</span></a>`;
    }).join('')}
  </div>`;
}

// getView даёт текущий вид карты: { lat, lon, zoom }.
export function addVariantNav(root, variant, getView) {
  const index = VARIANT_ORDER.indexOf(variant.id);
  const go = (shift) => {
    const next = VARIANT_ORDER[(index + shift + VARIANT_ORDER.length) % VARIANT_ORDER.length];
    const { lat, lon, zoom } = getView();
    window.location.search = `?v=${next}&nav=1&at=${lat.toFixed(5)},${lon.toFixed(5)},${zoom.toFixed(2)}`;
  };
  const nav = document.createElement('div');
  nav.className = 'vnav';
  nav.innerHTML = `<button type="button" data-shift="-1" aria-label="Предыдущий вариант">‹</button>
    <a href="./">${escapeHtml(label(variant))}</a>
    <button type="button" data-shift="1" aria-label="Следующий вариант">›</button>`;
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-shift]');
    if (btn) go(Number(btn.dataset.shift));
  });
  root.appendChild(nav);
  document.getElementById('back').innerHTML = `<a href="./" aria-label="К списку вариантов">${ICONS.back}</a>`;
}
