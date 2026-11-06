// list.js — чипсы и список партнёров в шторке, окно «Категории», карточка партнёра.
import { LIST_CHUNK } from '../config.js';
import { escapeHtml, formatDistance, percent } from './dom.js';
import { ICONS, logoInner, merchantColor } from './icons.js';

let chipsEl = null;
let listEl = null;
let modalRoot = null;
let categories = [];
let selected = new Set();
let onJobs = () => {};
let onRow = () => {};
let rows = [];
let drawn = 0;
let areaRows = [];       // последний список области: к нему вернёмся из кластера
let onClusterClose = null; // задан, пока в шторке открыт кластер

// --- Чипсы --------------------------------------------------------------------

function renderChips() {
  const extra = categories.filter((c) => !c.chip);
  const extraCount = extra.filter((c) => selected.has(c.id)).length;
  const chip = (c) => `<button class="chip${selected.has(c.id) ? ' is-on' : ''}" data-cat="${c.id}">${escapeHtml(c.title)}</button>`;
  chipsEl.innerHTML = `${categories.filter((c) => c.chip).map(chip).join('')}
    <button class="chip chip--more${extraCount ? ' is-on' : ''}" data-more>Еще${extraCount ? ` · ${extraCount}` : ''} ${ICONS.caret}</button>`;
}

function emitJobs() {
  renderChips();
  onJobs([...selected]);
}

function onChipClick(e) {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  if (btn.dataset.more !== undefined) { openCategories(); return; }
  const id = btn.dataset.cat;
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  emitJobs();
}

// --- Окно «Категории» -----------------------------------------------------------

function closeModal() {
  const box = modalRoot.firstElementChild;
  if (!box) return;
  box.classList.remove('is-open');
  setTimeout(() => box.remove(), 240);
}

function openModal(html) {
  modalRoot.innerHTML = `<div class="modal"><div class="modal__dim" data-close></div><div class="modal__sheet"><div class="modal__grab" data-close><span></span></div>${html}</div></div>`;
  const box = modalRoot.firstElementChild;
  requestAnimationFrame(() => box.classList.add('is-open'));
  box.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
  return box;
}

function openCategories() {
  const extra = categories.filter((c) => !c.chip);
  const draft = new Set(extra.filter((c) => selected.has(c.id)).map((c) => c.id));
  const box = openModal(`
    <h2 class="modal__title">Категории</h2>
    <div class="radios">${extra.map((c) => `<button class="radio${draft.has(c.id) ? ' is-on' : ''}" data-cat="${c.id}"><span>${escapeHtml(c.title)}</span><i></i></button>`).join('')}</div>
    <button class="btn-yellow" data-apply>Применить</button>`);
  box.addEventListener('click', (e) => {
    const row = e.target.closest('.radio');
    if (row) {
      const { cat } = row.dataset;
      if (draft.has(cat)) draft.delete(cat);
      else draft.add(cat);
      row.classList.toggle('is-on');
    }
    if (e.target.closest('[data-apply]')) {
      extra.forEach((c) => selected.delete(c.id));
      draft.forEach((id) => selected.add(id));
      emitJobs();
      closeModal();
    }
  });
}

// --- Карточка партнёра -----------------------------------------------------------

export function openCard(point, { distance, onClose } = {}) {
  const m = point.merchant;
  const box = openModal(`
    <div class="card">
      <span class="card__logo" style="background:${merchantColor(m)}">${logoInner(m)}</span>
      <div class="card__head"><h2>${escapeHtml(m.name)}</h2><p>${escapeHtml(m.sub)}${distance ? ` · ${formatDistance(distance)}` : ''}</p></div>
      <strong>${percent(m)}</strong>
    </div>
    <p class="card__line">${escapeHtml(m.benefit)}${m.cond ? `. ${escapeHtml(m.cond)}` : ''}</p>
    <p class="card__line card__line--dim">${escapeHtml(m.until)}</p>
    <button class="btn-yellow" data-close>Понятно</button>`);
  box.classList.add('modal--card');
  box.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) onClose?.(); });
}

export const closeCard = closeModal;

// --- Список ----------------------------------------------------------------------

function rowHtml({ point }) {
  const m = point.merchant;
  return `<button class="row" data-id="${point.id}">
    <span class="row__logo" style="background:${merchantColor(m)}">${logoInner(m)}</span>
    <span class="row__text">
      <b>${escapeHtml(m.name)}</b>
      ${m.cond ? `<span>${escapeHtml(m.cond)}</span>` : ''}
      <span>${escapeHtml(m.until)}</span>
      <em>${escapeHtml(m.sub)}</em>
    </span>
    <strong>${percent(m)}</strong>
  </button>`;
}

function drawMore() {
  const next = rows.slice(drawn, drawn + LIST_CHUNK);
  listEl.insertAdjacentHTML('beforeend', next.map(rowHtml).join(''));
  drawn += next.length;
}

function fillList(data, headHtml = '') {
  rows = data;
  drawn = 0;
  listEl.innerHTML = headHtml || (rows.length ? '' : '<p class="list__empty">Здесь пока нет партнёров. Попробуйте сдвинуть карту или убрать фильтр.</p>');
  listEl.scrollTop = 0;
  drawMore();
}

export function setRows(data) {
  areaRows = data;
  if (!onClusterClose) fillList(data);
}

export function setLoading(flag) {
  listEl.classList.toggle('is-loading', flag && !onClusterClose);
}

// Партнёры одного кластера. Пока список открыт, сдвиг карты его не перезаписывает.
export function showClusterRows(points, onClose) {
  onClusterClose = onClose;
  chipsEl.hidden = true;
  fillList(points.map((point) => ({ point })), `<div class="list__head"><b>Партнёры здесь: ${points.length}</b><button type="button" data-cluster-close aria-label="Закрыть">✕</button></div>`);
}

export function closeClusterRows() {
  if (!onClusterClose) return;
  const done = onClusterClose;
  onClusterClose = null;
  chipsEl.hidden = false;
  fillList(areaRows);
  done();
}

export function initList({ chips, list, modal, allCategories, onJobsChange, onRowTap }) {
  chipsEl = chips;
  listEl = list;
  modalRoot = modal;
  categories = allCategories;
  onJobs = onJobsChange;
  onRow = onRowTap;
  renderChips();
  chipsEl.addEventListener('click', onChipClick);
  listEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-cluster-close]')) { closeClusterRows(); return; }
    const row = e.target.closest('.row');
    if (row) onRow(row.dataset.id);
  });
  listEl.addEventListener('scroll', () => {
    if (listEl.scrollTop + listEl.clientHeight > listEl.scrollHeight - 400 && drawn < rows.length) drawMore();
  }, { passive: true });
}
