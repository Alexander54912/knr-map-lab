// tiers.js — какой вид получает каждый пин: плашка, мини-плашка, логотип или точка.
// Только расчёт. Экран передаётся в view: { width, height, zoom, project(lat, lon) → {x, y}, safe }.
import { PIN_SIZE } from '../config.js';
import { latLonToQuadkey } from './tiles.js';

const byWeight = (a, b) => b.content.weight - a.content.weight || b.content.offerId - a.content.offerId;

function isOnScreen(p, view) {
  return p.x >= 0 && p.x <= view.width && p.y >= 0 && p.y <= view.height;
}

// Прод: на скрине около 20 плашек, остальные пины — кружки. Берём первых по весу на экране.
function prodTiers(offers, view, cfg) {
  const tiers = new Map();
  const canLabel = view.zoom >= cfg.labelMinZoom;
  let labels = 0;
  for (const offer of [...offers].sort(byWeight)) {
    const p = view.project(offer.latitude, offer.longitude);
    if (canLabel && labels < cfg.maxLabels && isOnScreen(p, view)) {
      tiers.set(offer.id, 'pill');
      labels += 1;
    } else {
      tiers.set(offer.id, 'logo');
    }
  }
  return tiers;
}

// Прямоугольник плашки: кружок стоит на точке, текст уходит вправо.
function labelRect(p, width) {
  const half = PIN_SIZE.pillH / 2;
  return { l: p.x - half - 3, r: p.x - half + width + 3, t: p.y - half - 3, b: p.y + half + 3 };
}

function circleRect(p, gap = 3) {
  const half = PIN_SIZE.logo / 2 + gap;
  return { l: p.x - half, r: p.x + half, t: p.y - half, b: p.y + half };
}

const overlaps = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const isFree = (rect, taken) => !taken.some((other) => overlaps(rect, other));

// Плашка не должна лезть под шапку, кнопки и шторку.
function fitsUi(rect, view) {
  const { top, bottom, right, controlsTop, controlsBottom } = view.safe;
  if (rect.t < top || rect.b > view.height - bottom || rect.l < 0 || rect.r > view.width) return false;
  return !(rect.r > view.width - right && rect.b > controlsTop && rect.t < controlsBottom);
}

// Сколько логотипов пускаем на один тайл: чем ближе карта, тем свободнее.
function logosPerTile(zoom) {
  if (zoom <= 14) return 1;
  if (zoom === 15) return 2;
  return 6;
}

// Фокус: центр видимой части карты, над шторкой.
function inFocus(p, view, focus) {
  const centerY = (view.safe.top + view.height - view.safe.bottom) / 2;
  return Math.abs(p.x - view.width / 2) <= focus.w / 2 && Math.abs(p.y - centerY) <= focus.h / 2;
}

// Логика: пин никуда не исчезает, меняется только его вес на экране.
// Лидер крупного тайла — плашка, лидеры мелких тайлов — логотипы, остальные — точки.
function logicTiers(offers, view, cfg) {
  const tiers = new Map();
  const taken = [];
  const leaders = new Set();
  const logos = new Map();
  const leaderLevel = view.zoom + cfg.leaderOffset;
  const logoLevel = view.zoom + cfg.logoOffset;
  const canLabel = view.zoom >= cfg.labelMinZoom;
  const full = view.zoom >= cfg.nameMinZoom;
  const limit = cfg.logosPerTile ?? logosPerTile(view.zoom);

  for (const offer of [...offers].sort(byWeight)) {
    const p = view.project(offer.latitude, offer.longitude);
    const key = latLonToQuadkey(offer.latitude, offer.longitude, Math.min(logoLevel, 23));
    const leaderKey = key.slice(0, leaderLevel);
    const logoKey = key.slice(0, logoLevel);

    // Вне фокуса пин становится точкой. Вблизи места хватает всем, поэтому там фокус не нужен.
    if (cfg.focus && !full && !inFocus(p, view, cfg.focus)) {
      tiers.set(offer.id, 'dot');
      continue;
    }

    // Вблизи пинов мало: плашку получает каждый, кому хватает места. Издалека — только лидер тайла.
    if (canLabel && (full || !leaders.has(leaderKey)) && isOnScreen(p, view)) {
      // Полная плашка не влезла — пробуем короткую, чтобы кэшбэк был виден у края экрана.
      const options = full ? [['pill', PIN_SIZE.pillW], ['mini', PIN_SIZE.miniW]] : [['mini', PIN_SIZE.miniW]];
      const fit = options.find(([, width]) => {
        const rect = labelRect(p, width);
        return fitsUi(rect, view) && isFree(rect, taken);
      });
      if (fit) {
        tiers.set(offer.id, fit[0]);
        leaders.add(leaderKey);
        logos.set(logoKey, (logos.get(logoKey) || 0) + 1);
        taken.push(labelRect(p, fit[1]));
        continue;
      }
    }

    // Варианты без точек: все, кто без плашки, остаются логотипами.
    if (cfg.restTier === 'logo') {
      tiers.set(offer.id, 'logo');
      continue;
    }

    if ((logos.get(logoKey) || 0) < limit) {
      const rect = circleRect(p);
      if (isFree(rect, taken)) {
        tiers.set(offer.id, 'logo');
        logos.set(logoKey, (logos.get(logoKey) || 0) + 1);
        taken.push(rect);
        continue;
      }
    }

    tiers.set(offer.id, 'dot');
  }
  return tiers;
}

export function assignTiers(offers, view, cfg) {
  return cfg.mode === 'tiers' ? logicTiers(offers, view, cfg) : prodTiers(offers, view, cfg);
}

// Площадь, которую пины закрывают на экране: нужна для сравнения вариантов.
export function coveredShare(items, view) {
  const area = { pill: PIN_SIZE.pillW * PIN_SIZE.pillH, mini: PIN_SIZE.miniW * PIN_SIZE.pillH, logo: Math.PI * (PIN_SIZE.logo / 2) ** 2, dot: Math.PI * (PIN_SIZE.dot / 2) ** 2 };
  const total = items.reduce((sum, item) => sum + (area[item.tier] || area.logo), 0);
  return total / (view.width * view.height);
}
