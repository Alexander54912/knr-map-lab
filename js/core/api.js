// api.js — мок бэкенда. Те же запросы и ответы, что у /api/v2/cb-offline/map-points и map-offers.
// Настоящий API с GitHub Pages недоступен, поэтому «сервер» работает в браузере на реальных точках.
import { collectByDistance } from './distance.js';
import { clusteringZoom, collect, distanceM, latLonToQuadkey, MIN_ZOOM, tileOffsetFor } from './tiles.js';

// Загруженные данные: { merchants, points }.
let db = { merchants: [], points: [] };

// Точка из компактного массива файла в объект. quadKey считаем один раз, как поле точки в проде.
function unpack(row, merchants) {
  const [id, merchantIndex, lat, lon, weight] = row;
  return { id, offerId: merchantIndex + 1, merchant: merchants[merchantIndex], lat, lon, weight, quadKey: latLonToQuadkey(lat, lon) };
}

export function loadPoints(json) {
  db = { merchants: json.merchants, points: json.points.map((row) => unpack(row, json.merchants)) };
  return db;
}

export const allPoints = () => db.points;

function inArea(point, area) {
  return point.lat <= area.topLeft.latitude && point.lat >= area.bottomRight.latitude
    && point.lon >= area.topLeft.longitude && point.lon <= area.bottomRight.longitude;
}

// MapFilterOfferService: фильтр по выбранным категориям.
function filtered(selectedJobs) {
  if (!selectedJobs?.length) return db.points;
  const wanted = new Set(selectedJobs);
  return db.points.filter((p) => wanted.has(p.merchant.cat));
}

// Выборка точек области. Прод по документу: только точки внутри экрана.
// wholeTiles — наш вариант: берём целиком тайлы, которых касается экран, чтобы кластеры не менялись при сдвиге.
function pointsForArea(req, cfg) {
  const inside = filtered(req.selectedJobs).filter((p) => inArea(p, req));
  if (!cfg.wholeTiles) return inside;
  const level = clusteringZoom(req.zoom, tileOffsetFor(req.zoom, cfg));
  const keys = new Set(inside.map((p) => p.quadKey.slice(0, level)));
  return filtered(req.selectedJobs).filter((p) => keys.has(p.quadKey.slice(0, level)));
}

// Синхронная часть: удобно считать метрики без задержки сети.
export function mapPointsNow(req, cfg) {
  if (req.zoom < MIN_ZOOM) return [];
  if (cfg.algorithm === 'distance') {
    // Группы считаются на весь город, поэтому от сдвига карты не меняются.
    const all = collectByDistance(req.zoom, filtered(req.selectedJobs), cfg, (req.selectedJobs || []).join());
    return all.filter((item) => inArea({ lat: item.latitude, lon: item.longitude }, req));
  }
  return collect(req.zoom, req.pointTypes, pointsForArea(req, cfg), cfg);
}

// Условная задержка сети, чтобы пины появлялись как в приложении: после жеста, а не во время него.
const latency = () => new Promise((resolve) => { setTimeout(resolve, 90 + Math.random() * 110); });

// POST /api/v2/cb-offline/map-points
export async function postMapPoints(req, cfg) {
  await latency();
  return { payload: { data: mapPointsNow(req, cfg) } };
}

// POST /api/v2/cb-offline/map-offers: партнёры области, ближайшие к центру экрана — первыми.
export function mapOffersNow(req) {
  const centerLat = (req.topLeft.latitude + req.bottomRight.latitude) / 2;
  const centerLon = (req.topLeft.longitude + req.bottomRight.longitude) / 2;
  const nearest = new Map();
  for (const point of filtered(req.selectedJobs)) {
    if (!inArea(point, req)) continue;
    const distance = distanceM(centerLat, centerLon, point.lat, point.lon);
    const best = nearest.get(point.offerId);
    if (!best || distance < best.distance) nearest.set(point.offerId, { point, distance });
  }
  return [...nearest.values()].sort((a, b) => a.distance - b.distance);
}

export async function postMapOffers(req) {
  await latency();
  return { payload: { data: mapOffersNow(req) } };
}

export function getPoint(id) {
  return db.points.find((p) => String(p.id) === String(id));
}
