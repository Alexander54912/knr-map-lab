// main.js — запуск лаборатории карты. Вариант выбирается ссылкой: ?v=prod, ?v=1…10 (кроме 7). Без него — список.
import { VARIANTS } from './config.js';
import { getPoint, loadPoints } from './core/api.js';
import { distanceM } from './core/tiles.js';
import { currentView, focusPoint, initMap, releaseFocus, select, setJobs, userPosition } from './map/map.js';
import { ICONS, setCategories } from './ui/icons.js';
import { closeCard, closeClusterRows, initList, openCard, setLoading, setRows, showClusterRows } from './ui/list.js';
import { addVariantNav, renderMenu } from './ui/menu.js';
import { getPosition, initSheet, setPosition } from './ui/sheet.js';

const params = new URLSearchParams(window.location.search);
const variant = VARIANTS[params.get('v')];

// Вид карты из ссылки: так переключатель сохраняет место и зум.
function startView() {
  const [lat, lon, zoom] = (params.get('at') || '').split(',').map(Number);
  return zoom ? { center: [lon, lat], zoom } : null;
}

function paintStaticIcons() {
  document.getElementById('back').innerHTML = ICONS.back;
  document.getElementById('zoom-in').innerHTML = ICONS.plus;
  document.getElementById('zoom-out').innerHTML = ICONS.minus;
  document.getElementById('locate').innerHTML = ICONS.locate;
  document.getElementById('to-map').innerHTML = `${ICONS.pin}<span>Карта</span>`;
}

// Отладка по ?hud=1: что сейчас на экране.
function showStats(s) {
  const hud = document.getElementById('hud');
  if (!hud) return;
  hud.textContent = `${variant.id} · зум ${s.zoom.toFixed(1)} · кластеры ${s.clusters} · пины ${s.pins} · подписи ${s.labels} · закрыто ${Math.round(s.covered * 100)}%`;
}

function openPoint(point, { zoomIn = false } = {}) {
  const [lon, lat] = userPosition();
  select(point.id);
  focusPoint(point, { zoomIn });
  openCard(point, { distance: distanceM(lat, lon, point.lat, point.lon), onClose: releaseFocus });
}

async function start() {
  paintStaticIcons();
  const [points, categories] = await Promise.all([
    fetch('data/points.json').then((r) => r.json()),
    fetch('data/categories.json').then((r) => r.json()),
  ]);
  loadPoints(points);
  setCategories(categories);

  if (params.has('hud')) {
    const hud = document.createElement('div');
    hud.id = 'hud';
    document.getElementById('app').appendChild(hud);
  }

  initSheet(document.getElementById('sheet'));
  initList({
    chips: document.getElementById('chips'),
    list: document.getElementById('list'),
    modal: document.getElementById('modal-root'),
    allCategories: categories,
    onJobsChange: setJobs,
    onRowTap: (id) => {
      closeClusterRows();
      setPosition('collapsed');
      openPoint(getPoint(id), { zoomIn: true });
    },
  });
  document.getElementById('to-map').onclick = () => setPosition('collapsed');

  const map = initMap('map', variant, {
    onOffers: setRows,
    onLoading: setLoading,
    onStats: showStats,
    startView: startView(),
    onPointTap: (point) => {
      closeClusterRows();
      if (getPosition() !== 'collapsed') setPosition('collapsed');
      openPoint(point);
    },
    // Точка из веера лежит внутри кластера: приближаем, чтобы показать её пином.
    onPointPick: (point) => openPoint(point, { zoomIn: true }),
    onClusterList: (cluster) => {
      const points = cluster.ids.map(getPoint).sort((a, b) => b.weight - a.weight);
      showClusterRows(points, () => setPosition('collapsed'));
      setPosition('mid');
    },
    onMapTap: () => {
      select(null);
      closeCard();
      closeClusterRows();
      releaseFocus();
    },
  });
  window.knr = { map, variant };
  if (params.has('nav')) addVariantNav(document.getElementById('app'), variant, currentView);
}

if (variant) start();
else renderMenu(document.getElementById('app'));
