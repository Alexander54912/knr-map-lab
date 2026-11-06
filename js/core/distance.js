// distance.js — кластеры без тайлов: точки объединяются, если рядом на экране.
// В проде такого нет. Сильные партнёры выбираются первыми и собирают соседей вокруг себя.
import { toCluster, toOffers } from './tiles.js';

const cache = new Map();

// Положение точки на экране при этом зуме, pt.
function screenXY(point, zoom) {
  const size = 256 * 2 ** zoom;
  const rad = (point.lat * Math.PI) / 180;
  return {
    x: ((point.lon + 180) / 360) * size,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * size,
  };
}

function build(zoom, points, cfg) {
  if (zoom > cfg.zoomStopClustering) return toOffers(points);
  const radius = cfg.clusterRadius;
  const items = points.map((point) => ({ point, ...screenXY(point, zoom), used: false }));
  const grid = new Map();
  const cellOf = (v) => Math.floor(v / radius);
  for (const item of items) {
    const key = `${cellOf(item.x)}/${cellOf(item.y)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(item);
  }
  const neighbours = (item) => {
    const found = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const other of grid.get(`${cellOf(item.x) + dx}/${cellOf(item.y) + dy}`) || []) {
          if (!other.used && (other.x - item.x) ** 2 + (other.y - item.y) ** 2 <= radius ** 2) found.push(other);
        }
      }
    }
    return found;
  };

  const result = [];
  const singles = [];
  for (const item of [...items].sort((a, b) => b.point.weight - a.point.weight)) {
    if (item.used) continue;
    const group = neighbours(item);
    if (group.length >= cfg.minPointsInCluster) {
      group.forEach((other) => { other.used = true; });
      result.push(...toCluster(group.map((other) => other.point)));
    } else {
      item.used = true;
      singles.push(item.point);
    }
  }
  return [...result, ...toOffers(singles)];
}

export function collectByDistance(zoom, points, cfg, cacheKey) {
  const key = `${cfg.clusterRadius}|${zoom}|${cacheKey}`;
  if (!cache.has(key)) cache.set(key, build(zoom, points, cfg));
  return cache.get(key);
}
