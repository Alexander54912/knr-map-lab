// dom.js — мелкие помощники для разметки.

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} м`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} км`;
}

// Короткий кэшбэк для мини-плашки и списка: «20%».
export const percent = (merchant) => `${merchant.pct}%`;

// Всплывающая подсказка снизу.
export function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.getElementById('app').appendChild(el);
  setTimeout(() => el.remove(), 2400);
}
