// map.js — карта и цикл «сдвинули карту → запрос → пины и список». Как в проде: пересчёт после жеста.
/* global maplibregl */
import { MAP, SHEET } from '../config.js';
import { getPoint, postMapOffers, postMapPoints } from '../core/api.js';
import { assignTiers, coveredShare } from '../core/tiers.js';
import { toast } from '../ui/dom.js';
import { closeFan, openFan } from './fan.js';
import { PinLayer } from './pins.js';
import { addMetroIcon, mapStyle } from './style.js';

const ML_SHIFT = 1;  // зум прода = зум MapLibre + 1
const POINT_TYPES = ['OFFER', 'SIMPLE_CLUSTER'];

let map = null;
let pins = null;
let userMarker = null;
let variant = null;
let hooks = {};
let selectedJobs = [];
let selectedId = null;
let lastResponse = [];
let ticket = 0;
let timer = null;

export const stats = { zoom: 0, clusters: 0, pins: 0, labels: 0, covered: 0 };

// Целый зум для запроса (раздел 9.10 документа: floor).
export const requestZoom = () => Math.floor(map.getZoom() + ML_SHIFT);

function area() {
  const b = map.getBounds();
  return {
    topLeft: { latitude: b.getNorth(), longitude: b.getWest() },
    bottomRight: { latitude: b.getSouth(), longitude: b.getEast() },
  };
}

// Экран для расчёта вида пинов: где шапка, кнопки и шторка.
function screen() {
  const box = map.getContainer();
  const width = box.clientWidth;
  const height = box.clientHeight;
  return {
    width,
    height,
    zoom: requestZoom(),
    project: (lat, lon) => map.project([lon, lat]),
    safe: { top: 96, bottom: SHEET.collapsedPx + 6, right: 62, controlsTop: height * 0.4, controlsBottom: height * 0.6 },
  };
}

// Ответ сервера в то, что рисуем: кластеры и пины отдельно, как map-points-holder-factory.
function draw(data) {
  const view = screen();
  const clusters = data.filter((p) => p.pointType === 'SIMPLE_CLUSTER');
  const offers = data.filter((p) => p.pointType === 'OFFER');
  const tiers = assignTiers(offers, view, variant.pins);

  const items = [
    ...clusters.map((c) => ({
      id: `c${c.id}`,
      kind: 'cluster',
      lat: c.latitude,
      lon: c.longitude,
      tier: 'cluster',
      count: c.content.count,
      ids: c.content.ids,
      bounds: c.content.bounds,
      rest: c.content.rest,
      attached: c.content.attached,
    })),
    ...offers.map((o, i) => ({
      id: o.id,
      kind: 'offer',
      lat: o.latitude,
      lon: o.longitude,
      tier: o.id === selectedId ? 'pill' : tiers.get(o.id),
      selected: o.id === selectedId,
      rank: offers.length - i,
      point: getPoint(o.id),
    })),
  ];
  pins.render(items);

  const onScreen = items.filter((item) => {
    const p = view.project(item.lat, item.lon);
    return p.x >= 0 && p.x <= view.width && p.y >= 0 && p.y <= view.height;
  });
  stats.zoom = map.getZoom() + ML_SHIFT;
  stats.clusters = onScreen.filter((i) => i.kind === 'cluster').length;
  stats.pins = onScreen.filter((i) => i.kind === 'offer').length;
  stats.labels = onScreen.filter((i) => i.tier === 'pill' || i.tier === 'mini').length;
  stats.covered = coveredShare(onScreen, view);
  hooks.onStats?.(stats);
}

// Один запрос пинов и списка. Устаревшие ответы отбрасываем.
async function refresh() {
  const mine = ++ticket;
  const request = { ...area(), pointTypes: POINT_TYPES, selectedJobs, zoom: requestZoom() };
  hooks.onLoading?.(true);
  const [points, offers] = await Promise.all([postMapPoints(request, variant.backend), postMapOffers(request)]);
  if (mine !== ticket) return;
  lastResponse = points.payload.data;
  draw(lastResponse);
  hooks.onOffers?.(offers.payload.data);
  hooks.onLoading?.(false);
}

function scheduleRefresh() {
  clearTimeout(timer);
  timer = setTimeout(refresh, 80);
}

export function setJobs(jobs) {
  selectedJobs = jobs;
  refresh();
}

export function select(pointId) {
  selectedId = pointId ? String(pointId) : null;
  draw(lastResponse);
}

// Показать точку над карточкой. Из списка точка могла быть в кластере, поэтому там приближаем до отдельного пина.
export function focusPoint(point, { zoomIn = false, bottomPad = 260 } = {}) {
  selectedId = String(point.id);
  const zoom = zoomIn ? Math.max(map.getZoom(), 16.5 - ML_SHIFT) : map.getZoom();
  map.easeTo({ center: [point.lon, point.lat], zoom, padding: { top: 90, bottom: bottomPad, left: 0, right: 0 }, duration: 420 });
}

const NO_PADDING = { top: 0, bottom: 0, left: 0, right: 0 };

// Карточку закрыли: плавно возвращаем обычные отступы, чтобы карта не дёрнулась.
export function releaseFocus() {
  map.easeTo({ padding: NO_PADDING, duration: 240 });
}

// Откуда считаем расстояние в карточке.
export const userPosition = () => userMarker?.getLngLat().toArray() || MAP.userLocation;

function initControls() {
  document.getElementById('zoom-in').onclick = () => map.zoomIn({ duration: 260 });
  document.getElementById('zoom-out').onclick = () => map.zoomOut({ duration: 260 });
  document.getElementById('locate').onclick = locate;
}

function showUser(lngLat) {
  if (!userMarker) {
    const el = document.createElement('div');
    el.className = 'user-dot';
    userMarker = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
  } else {
    userMarker.setLngLat(lngLat);
  }
  map.easeTo({ center: lngLat, zoom: Math.max(map.getZoom(), 14.5 - ML_SHIFT), padding: NO_PADDING, duration: 500 });
}

function locate() {
  const demo = () => {
    toast('Показываем демо-локацию в Москве');
    showUser(MAP.userLocation);
  };
  if (!navigator.geolocation) { demo(); return; }
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude, longitude } = pos.coords;
    const inMoscow = Math.abs(latitude - 55.75) < 0.5 && Math.abs(longitude - 37.62) < 0.8;
    if (inMoscow) showUser([longitude, latitude]);
    else demo();
  }, demo, { timeout: 5000, maximumAge: 60000 });
}

// --- Тап по кластеру: у каждого варианта своё раскрытие ------------------------

function zoomInto(cluster, delta) {
  map.easeTo({ center: [cluster.lon, cluster.lat], zoom: Math.min(map.getZoom() + delta, map.getMaxZoom()), padding: NO_PADDING, duration: 420 });
}

// Приблизить так, чтобы вошли все точки. Минимум на один зум, иначе тап выглядит как сбой.
function fitCluster(cluster) {
  const [west, south, east, north] = cluster.bounds;
  const camera = map.cameraForBounds([[west, south], [east, north]], { padding: { top: 120, bottom: SHEET.collapsedPx + 50, left: 50, right: 80 } });
  const zoom = Math.min(Math.max(camera?.zoom ?? 0, map.getZoom() + 1), map.getMaxZoom());
  map.easeTo({ center: camera?.center ?? [cluster.lon, cluster.lat], zoom, padding: NO_PADDING, duration: 520 });
}

// Сдвиг вверх, чтобы кластер оказался посреди видимой части карты.
function liftCluster(cluster, liftPx) {
  map.easeTo({ center: [cluster.lon, cluster.lat], offset: [0, -liftPx], duration: 320 });
}

function openCluster(cluster) {
  const { mode, delta, max } = variant.tap;
  if (mode === 'fit') fitCluster(cluster);
  else if (mode === 'fan' && cluster.count <= max) {
    liftCluster(cluster, 40);
    openFan(map, cluster, (point) => hooks.onPointPick?.(point));
  } else if (mode === 'list') {
    liftCluster(cluster, map.getContainer().clientHeight * 0.24);
    hooks.onClusterList?.(cluster);
  } else zoomInto(cluster, delta);
}

export const currentView = () => {
  const c = map.getCenter();
  return { lat: c.lat, lon: c.lng, zoom: map.getZoom() + ML_SHIFT };
};

export function initMap(container, currentVariant, handlers) {
  variant = currentVariant;
  hooks = handlers;
  map = new maplibregl.Map({
    container,
    style: mapStyle(variant.map),
    center: handlers.startView?.center || MAP.center,
    zoom: (handlers.startView?.zoom || MAP.startZoom) - ML_SHIFT,
    minZoom: MAP.minZoom - ML_SHIFT,
    maxZoom: MAP.maxZoom - ML_SHIFT,
    maxBounds: MAP.bounds,
    renderWorldCopies: false,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
  // Подпись источника остаётся, но свёрнута в значок, чтобы не закрывать карту.
  map.once('load', () => {
    const attribution = map.getContainer().querySelector('.maplibregl-ctrl-attrib');
    attribution?.removeAttribute('open');
    attribution?.classList.remove('maplibregl-compact-show');
  });
  map.on('styleimagemissing', (e) => { if (e.id === 'metro' && !map.hasImage('metro')) addMetroIcon(map); });

  pins = new PinLayer(map, {
    onOfferTap: (id) => handlers.onPointTap?.(getPoint(id)),
    onClusterTap: openCluster,
    animate: Boolean(variant.animate),
  });
  map.on('click', () => { closeFan(); handlers.onMapTap?.(); });
  map.on('dragstart', closeFan);
  map.on('moveend', scheduleRefresh);

  // Вариант 10: вид пинов меняется прямо во время сдвига, без нового запроса.
  if (variant.liveTiers) {
    let last = 0;
    map.on('move', () => {
      const now = performance.now();
      if (now - last < 120) return;
      last = now;
      draw(lastResponse);
    });
  }

  // Вариант 9: группы пересчитываются на каждом целом зуме, не дожидаясь конца жеста.
  if (variant.liveZoom) {
    let zoomNow = requestZoom();
    map.on('zoom', () => {
      if (requestZoom() === zoomNow) return;
      zoomNow = requestZoom();
      refresh();
    });
  }

  // Пины не ждут подложку: иначе на медленной сети экран долго пустой.
  refresh();
  initControls();
  return map;
}
