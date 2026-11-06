// icons.js — значки категорий и кнопок. Настоящих логотипов нет: у брендов буквы на цвете бренда.
import { escapeHtml } from './dom.js';

// Пути на сетке 24×24. Второй слой чуть прозрачнее: на проде значки двухтонные.
const GLYPHS = {
  food: ['M7 3v6.5c0 1.1.6 2 1.5 2.4V21h2.2v-9.1c.9-.4 1.5-1.3 1.5-2.4V3h-1.4v5.6h-.9V3H8.4v5.6h-.9V3z', 'M15.8 3c-1.8 1.3-2.6 3.9-2.6 6.7V14h2.4v7h2.2V3z'],
  cup: ['M6 7h12l-1.5 13.1a1 1 0 0 1-1 .9h-7a1 1 0 0 1-1-.9z', 'M5 3.6h14V7H5z'],
  clothes: ['M8.3 3 2.8 6.2l2 4 2.2-1V21h10V9.2l2.2 1 2-4L15.7 3c-.6 1.6-2 2.6-3.7 2.6S8.9 4.6 8.3 3z'],
  health: ['M9 4h6a1 1 0 0 1 1 1v2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V5a1 1 0 0 1 1-1zm1 1.8V7h4V5.8zM11 10v2.5H8.5v2H11V17h2v-2.5h2.5v-2H13V10z'],
  beauty: ['M12 8.2c1-1.5 3-2.5 4.6-1.9 1.7.6 3.6 2.9 5 5.2-2 3.5-5.5 6.2-9.6 6.2s-7.6-2.7-9.6-6.2c1.4-2.3 3.3-4.6 5-5.2 1.6-.6 3.6.4 4.6 1.9z'],
  grocery: ['M6 8h12l1 12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z', 'M9 9V7a3 3 0 0 1 6 0v2h-1.6V7a1.4 1.4 0 0 0-2.8 0v2z'],
  home: ['M12 3 3 11h2.5v9h5v-6h3v6h5v-9H21z'],
  flowers: ['M12 11.2c-3.3 0-5.5-2.2-5.5-5.5V3l2.7 2L12 2.5 14.8 5l2.7-2v2.7c0 3.3-2.2 5.5-5.5 5.5z', 'M11 12.2h2V16c1.2-1.4 3-2.2 5-2.2 0 3.6-2.6 6.4-6 6.7-3.4-.3-6-3.1-6-6.7 2 0 3.8.8 5 2.2z'],
  auto: ['M5 11l1.5-4.2A2.5 2.5 0 0 1 8.9 5h6.2a2.5 2.5 0 0 1 2.4 1.8L19 11a2 2 0 0 1 2 2v4a1 1 0 0 1-1 1h-1v1.5a1.5 1.5 0 0 1-3 0V18H8v1.5a1.5 1.5 0 0 1-3 0V18H4a1 1 0 0 1-1-1v-4a2 2 0 0 1 2-2zm2.2 0h9.6l-1-3a1 1 0 0 0-1-.7H9.2a1 1 0 0 0-1 .7zM7 15.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zm10 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z'],
  kids: ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8.8 8.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zm6.4 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zM7.6 14c.8 2 2.4 3.2 4.4 3.2s3.6-1.2 4.4-3.2z'],
  pets: ['M12 11c3 0 6 3.4 6 6.4 0 2-1.4 2.9-3 2.9-1.100 0-2-.5-3-.5s-1.900.5-3 .5c-1.600 0-3-.9-3-2.900C6 14.400 9 11 12 11z', 'M5.700 7.500a2 2.600 0 1 0 0 5.200 2 2.600 0 0 0 0-5.200zm12.600 0a2 2.600 0 1 0 0 5.200 2 2.600 0 0 0 0-5.200zM9.300 3.500a2 2.700 0 1 0 0 5.400 2 2.700 0 0 0 0-5.400zm5.400 0a2 2.700 0 1 0 0 5.400 2 2.700 0 0 0 0-5.400z'],
  travel: ['M21 15.500v-2l-8-5V4a1.500 1.500 0 0 0-3 0v4.500l-7 5v2l7-2.200V18l-2 1.500V21l3.500-1 3.500 1v-1.500L13 18v-4.700z'],
  sport: ['M3 10h2V8h2v8H5v-2H3zm18 0h-2V8h-2v8h2v-2h2z', 'M8 11h8v2H8z'],
  tech: ['M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z', 'M10 17h4l.6 2.500H17V21H7v-1.500h2.400z'],
  jewelry: ['M7 4h10l4 5-9 11L3 9z'],
  services: ['M21.200 6.500a5.500 5.500 0 0 1-7.400 5.200L6 19.400a2 2 0 1 1-2.800-2.800l7.600-7.700A5.500 5.500 0 0 1 17.600 2L14 5.600 15 9l3.400 1 3.600-3.600z'],
  hobby: ['M10 3a2 2 0 0 1 2 2v1h5a1 1 0 0 1 1 1v4h1a2 2 0 1 1 0 4h-1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5h1.500a2 2 0 1 0 0-4H4V7a1 1 0 0 1 1-1h3V5a2 2 0 0 1 2-2z'],
  heart: ['M12 20.500S3.500 15.400 3.500 9.300A4.800 4.800 0 0 1 12 6.400a4.800 4.800 0 0 1 8.500 2.900c0 6.100-8.500 11.200-8.500 11.200z'],
};

export function glyph(name, fill = '#fff') {
  const paths = GLYPHS[name] || GLYPHS.services;
  const body = paths.map((d, i) => `<path fill="${fill}" fill-rule="evenodd" ${i ? 'opacity=".82"' : ''} d="${d}"/>`).join('');
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

let categories = new Map();
export function setCategories(list) {
  categories = new Map(list.map((c) => [c.id, c]));
}

// Цвет партнёра: цвет бренда или категории.
export function merchantColor(merchant) {
  return merchant.logo ? merchant.logo[1] : categories.get(merchant.cat)?.color || '#5ab8f5';
}

// Содержимое круглого логотипа: значок категории или буквы бренда.
export function logoInner(merchant) {
  if (!merchant.logo) return glyph(merchant.glyph);
  const [text, , fg] = merchant.logo;
  if (GLYPHS[text]) return glyph(text, fg);
  return `<span class="mono mono--${Math.min(text.length, 5)}" style="color:${fg}">${escapeHtml(text)}</span>`;
}

// Кнопки.
export const ICONS = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M4 12h16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  locate: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M21 3 3 10.500l7.500 2.300L13.200 21z"/><path fill="#8e8e93" d="m21 3-10.500 9.800L13.200 21z"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path fill="#1c1c1e" d="M12 2a7.500 7.500 0 0 0-7.500 7.500C4.500 14.800 12 22 12 22s7.500-7.200 7.500-12.500A7.500 7.500 0 0 0 12 2z"/><circle cx="12" cy="9.500" r="3" fill="#fff"/></svg>',
  caret: '<svg viewBox="0 0 12 8"><path fill="currentColor" d="M1 1h10L6 7z"/></svg>',
};
