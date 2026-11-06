// config.js — все настройки лаборатории карты. Новый вариант = новая запись в VARIANTS.

// Общее для вариантов 1–10: меняется только то, что указано в самом варианте.
const COMMON = {
  tap: { mode: 'zoom', delta: 2 },
  backend: { minPointsInCluster: 5, zoomStopClustering: 21, tileOffset: 1, wholeTiles: true },
  pins: { mode: 'tiers', labelMinZoom: 10, nameMinZoom: 16, leaderOffset: 1, logoOffset: 1, restTier: 'logo' },
  map: { poi: false },
};

function variant(id, title, note, { tap, backend, pins, ...rest } = {}) {
  return {
    id,
    title,
    note,
    tap: tap || COMMON.tap,
    backend: { ...COMMON.backend, ...backend },
    pins: { ...COMMON.pins, ...pins },
    map: COMMON.map,
    ...rest,
  };
}

// backend — то, что в проде лежит на сервере (cb-offline.map.*).
// pins — как фронт показывает пины. map — подложка. tap — что делает тап по кластеру.
export const VARIANTS = {
  // Как сейчас: значения из документа «Тайлы и пины».
  prod: {
    id: 'prod',
    title: 'Как сейчас',
    note: 'Копия прода: порог 10, тайл 128 pt, 20 плашек',
    tap: { mode: 'zoom', delta: 2 },
    backend: {
      minPointsInCluster: 10,   // кластер, если в тайле 10 точек и больше
      zoomStopClustering: 21,   // до этого зума включительно кластеры работают
      tileOffset: 1,            // getClusteringZoom: тайл на уровень глубже зума
      wholeTiles: false,        // точки обрезаются по экрану, потом кластеризуются
    },
    pins: {
      mode: 'prod',
      labelMinZoom: 10,         // с этого зума пин открывается в плашку с кэшбэком
      maxLabels: 20,            // на скрине прода около 20 плашек: первые по весу
    },
    map: { poi: true },         // подписи заведений на подложке, как на проде
  },

  1: variant('1', 'Порог 7', 'Кластер от 7 точек, тап +2 зума', { backend: { minPointsInCluster: 7 } }),
  2: variant('2', 'Порог 5', 'Кластер от 5 точек, тап +2 зума'),
  3: variant('3', 'Крупный тайл', 'Тайл 256 pt, кластер от 10 точек, тап +2 зума', { backend: { minPointsInCluster: 10, tileOffset: 0 } }),
  4: variant('4', 'Тайл дробится', 'Тайлы 256, 128 и 64 pt по мере приближения', {
    tap: { mode: 'fit' },
    backend: { tileBands: [[11, 0], [13, 1], [99, 2]] },
  }),
  5: variant('5', 'Лимит в тайле', 'До 3 пинов на тайл, остальные в «+N»', {
    tap: { mode: 'zoom', delta: 1 },
    backend: { maxPinsInTile: 3 },
  }),
  6: variant('6', 'Лидер тайла', '1 пин с кэшбэком и значок «+N» на нём', {
    tap: { mode: 'fit' },
    backend: { maxPinsInTile: 1, badgeOnLeader: true },
  }),
  8: variant('8', 'Кластер в шторку', 'Тап открывает партнёров кластера списком', { tap: { mode: 'list' } }),
  9: variant('9', 'По расстоянию', 'Без тайлов: группа в радиусе 60 pt, плавный разлёт', {
    tap: { mode: 'fit' },
    backend: { algorithm: 'distance', clusterRadius: 60, minPointsInCluster: 3, zoomStopClustering: 18 },
    animate: true,
    liveZoom: true,
  }),
  10: variant('10', 'Фокус экрана', 'В центре логотипы и кэшбэк, по краям точки', {
    backend: { zoomStopClustering: 12 },
    pins: { restTier: 'dot', logosPerTile: 3, focus: { w: 230, h: 340 } },
    liveTiers: true,
  }),
};

// Порядок в списке: числовые ключи JS всё равно ставит первыми.
// Номера не сдвигаем: ссылки уже разосланы. «Логика» и 7 убраны по просьбе пользователя 2026-11-06.
export const VARIANT_ORDER = ['prod', '1', '2', '3', '4', '5', '6', '8', '9', '10'];

// Карта. Зумы — в шкале прода (тайл 256 px). У MapLibre шкала на единицу меньше.
export const MAP = {
  center: [37.5894, 55.7761],   // центр скриншота прода
  startZoom: 14.2,
  minZoom: 8.5,
  maxZoom: 20,
  bounds: [[35.9, 54.9], [39.3, 56.6]],
  userLocation: [37.5950, 55.7700],
};

// Шторка: высоты положений.
export const SHEET = {
  collapsedPx: 136,
  midRatio: 0.52,
  durationMs: 280,
  velocityThreshold: 0.5,
};

export const LIST_CHUNK = 30;

// Размеры пинов, pt: нужны для расчёта наложений.
export const PIN_SIZE = { logo: 30, dot: 10, pillH: 33, pillW: 178, miniW: 70 };
