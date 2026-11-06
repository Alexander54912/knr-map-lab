// tiles.js — порт продовой кластеризации (MapPointCollector + стратегии) на JS.
// Источник — «Тайлы и пины», разделы 3.7, 3.8, 5, 9.3. Только расчёты: ни карты, ни страницы здесь нет.

export const MIN_ZOOM = 7;       // ниже прод отвечает пустым списком
export const MAX_ZOOM = 23;
export const QUADKEY_LENGTH = 23;

// QuadKey по схеме Bing: одна цифра 0–3 на каждый уровень.
export function latLonToQuadkey(lat, lon, level = QUADKEY_LENGTH) {
  const size = 2 ** level;
  const latRad = (lat * Math.PI) / 180;
  const x = Math.floor(((lon + 180) / 360) * size);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * size);
  let key = '';
  for (let z = level; z > 0; z--) {
    const mask = 2 ** (z - 1);
    const digit = (Math.floor(x / mask) % 2) + 2 * (Math.floor(y / mask) % 2);
    key += digit;
  }
  return key;
}

// getClusteringZoom: в проде tileOffset = 1, то есть тайл на уровень глубже зума.
export function clusteringZoom(zoom, tileOffset = 1) {
  return Math.min(zoom + tileOffset, MAX_ZOOM);
}

// Рычаг лаборатории: своя глубина тайла на разных зумах. tileBands: [[до какого зума, глубина], ...].
export function tileOffsetFor(zoom, cfg) {
  const band = cfg.tileBands?.find(([maxZoom]) => zoom <= maxZoom);
  return band ? band[1] : cfg.tileOffset;
}

// OffersMapHelper.round: 4 знака, примерно 10 м.
export const round4 = (value) => Math.round(value * 10000) / 10000;

// GeoDistanceCalculator.distanceInMeters — считаем гаверсинусом.
export function distanceM(aLat, aLon, bLat, bLon) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// Clusters.calculateHash: хэш отсортированных id, неотрицательный, строкой.
function clusterId(points) {
  const text = points.map((p) => String(p.id)).sort().join(',');
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return String(hash & 0x7fffffff);
}

// Clusters.findNearestToCentral: реальная точка, ближайшая к среднему арифметическому координат.
function nearestToCentral(points) {
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const lon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;
  let best = points[0];
  let bestDistance = Infinity;
  for (const p of points) {
    const d = distanceM(lat, lon, p.lat, p.lon);
    if (d < bestDistance) { bestDistance = d; best = p; }
  }
  return best;
}

// SimpleClusterConvertStrategy.
function clusterApplicable(zoom, pointTypes, points, cfg) {
  // В проде порог один на все зумы. minPointsByZoom — наш рычаг: свой порог на отдельном зуме.
  const minPoints = cfg.minPointsByZoom?.[zoom] ?? cfg.minPointsInCluster;
  return pointTypes.includes('SIMPLE_CLUSTER')
    && points.length >= minPoints
    && zoom <= cfg.zoomStopClustering;
}

// Границы группы: нужны, чтобы приблизить карту ровно на её точки.
function boundsOf(points) {
  return [
    Math.min(...points.map((p) => p.lon)), Math.min(...points.map((p) => p.lat)),
    Math.max(...points.map((p) => p.lon)), Math.max(...points.map((p) => p.lat)),
  ];
}

// ids и bounds в проде нет: их пришлось бы добавить в ответ, чтобы раскрывать кластер без нового запроса.
export function toCluster(points) {
  const center = nearestToCentral(points);
  return [{
    id: clusterId(points),
    pointType: 'SIMPLE_CLUSTER',
    latitude: center.lat,
    longitude: center.lon,
    content: { type: 'SIMPLE_CLUSTER', count: points.length, ids: points.map((p) => String(p.id)), bounds: boundsOf(points) },
  }];
}

// Лимит в тайле: первые по весу остаются пинами, остальные уходят в значок «+N».
function toLimitedTile(points, cfg) {
  const sorted = [...points].sort((a, b) => b.weight - a.weight || b.offerId - a.offerId);
  const top = sorted.slice(0, cfg.maxPinsInTile);
  const rest = sorted.slice(cfg.maxPinsInTile);
  const [badge] = toCluster(rest);
  badge.content.rest = true;
  badge.content.bounds = boundsOf(points);
  if (cfg.badgeOnLeader) {
    badge.latitude = round4(top[0].lat);
    badge.longitude = round4(top[0].lon);
    badge.content.attached = true;
  }
  return [...toOffers(top), badge];
}

// OfferPointConvertStrategy: координаты округляются, сортировка по весу, потом по offerId.
export function toOffers(points) {
  return points
    .map((p) => ({
      id: String(p.id),
      pointType: 'OFFER',
      latitude: round4(p.lat),
      longitude: round4(p.lon),
      content: {
        type: 'OFFER',
        offerId: p.offerId,
        weight: p.weight,
        merchantName: p.merchant.name,
        cashback: { value: p.merchant.pct, text: p.merchant.benefit },
      },
    }))
    .sort((a, b) => b.content.weight - a.content.weight || b.content.offerId - a.content.offerId);
}

// MapPointCollector.collect: бакеты по префиксу QuadKey, затем стратегия на каждый тайл.
export function collect(zoom, pointTypes, points, cfg) {
  const level = clusteringZoom(zoom, tileOffsetFor(zoom, cfg));
  const tiles = new Map();
  for (const point of points) {
    const key = point.quadKey.slice(0, level);
    if (!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push(point);
  }
  const result = [];
  for (const tilePoints of tiles.values()) {
    if (cfg.maxPinsInTile && tilePoints.length > cfg.maxPinsInTile) result.push(...toLimitedTile(tilePoints, cfg));
    else if (clusterApplicable(zoom, pointTypes, tilePoints, cfg)) result.push(...toCluster(tilePoints));
    else if (pointTypes.includes('OFFER')) result.push(...toOffers(tilePoints));
  }
  return result;
}
