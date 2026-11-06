// style.js — тёмная подложка как на скриншотах прода. Векторные тайлы OpenFreeMap: без ключа, Россия покрыта.
// Цвета сняты со скриншотов. Зумы здесь в шкале MapLibre: на единицу меньше шкалы прода.

const ROAD = '#536da2';        // крупные дороги
const ROAD_MID = '#46598a';
const ROAD_MINOR = '#394760';  // мелкие улицы
const LAND = '#2f3c4c';
const LAND_DARK = '#2a3447';
const GREEN = '#0e483e';
const CITY = '#27484d';
const WATER = '#01256e';

const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];
const NAME = ['coalesce', ['get', 'name:ru'], ['get', 'name']];

const roadWidth = (min, max) => ['interpolate', ['exponential', 1.6], ['zoom'], 8, min, 19, max];
const roadsOf = (classes) => ['all', ['in', ['get', 'class'], ['literal', classes]], ['!=', ['get', 'brunnel'], 'tunnel']];

function baseLayers() {
  return [
    { id: 'bg', type: 'background', paint: { 'background-color': ['interpolate', ['linear'], ['zoom'], 7, GREEN, 9, '#17484a', 10.5, CITY, 11.5, LAND] } },
    { id: 'wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass']]],
      paint: { 'fill-color': ['interpolate', ['linear'], ['zoom'], 7, '#0c4e43', 11, '#1f5048', 14, '#2b4a4c'], 'fill-opacity': 0.85 } },
    { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': '#2b4d4c', 'fill-opacity': 0.8 } },
    { id: 'residential', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood']]],
      maxzoom: 12, paint: { 'fill-color': CITY, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.9, 11.5, 0] } },
    { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': WATER } },
    { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: { 'line-color': '#7d8fa6', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 2] } },
    { id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': LAND_DARK, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, 1] } },
    { id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 10, filter: ['==', ['get', 'class'], 'rail'],
      paint: { 'line-color': '#4d5a73', 'line-width': 1, 'line-dasharray': [3, 2] } },
    { id: 'road-minor', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11, filter: roadsOf(['minor', 'service', 'track']),
      layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ROAD_MINOR, 'line-width': roadWidth(0.3, 9) } },
    { id: 'road-mid', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 9, filter: roadsOf(['secondary', 'tertiary']),
      layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ROAD_MID, 'line-width': roadWidth(0.4, 15) } },
    { id: 'road-major', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: roadsOf(['motorway', 'trunk', 'primary']),
      layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['interpolate', ['linear'], ['zoom'], 7, '#9fb0bd', 10, '#7f93b0', 12, ROAD], 'line-width': roadWidth(0.8, 21) } },
  ];
}

function labelLayers() {
  return [
    { id: 'road-name', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 12.5,
      layout: { 'symbol-placement': 'line', 'text-field': NAME, 'text-font': FONT, 'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10.5, 18, 13] },
      paint: { 'text-color': '#a9b7cc', 'text-halo-color': LAND, 'text-halo-width': 1.2 } },
    { id: 'water-name', type: 'symbol', source: 'omt', 'source-layer': 'water_name',
      layout: { 'text-field': NAME, 'text-font': ['Noto Sans Italic'], 'text-size': 12 }, paint: { 'text-color': '#9fb6d6', 'text-halo-color': '#0d2b5e', 'text-halo-width': 1 } },
    { id: 'place-small', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 9, filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood', 'village', 'hamlet']]],
      layout: { 'text-field': NAME, 'text-font': FONT, 'text-size': 12, 'text-max-width': 8 }, paint: { 'text-color': '#cdd6e2', 'text-halo-color': '#22303e', 'text-halo-width': 1.2 } },
    { id: 'place-city', type: 'symbol', source: 'omt', 'source-layer': 'place', filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
      layout: { 'text-field': NAME, 'text-font': FONT, 'text-size': ['interpolate', ['linear'], ['zoom'], 7, 13, 12, 16] }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#17343b', 'text-halo-width': 1.3 } },
  ];
}

// Метро: красная «М» и название, как на проде.
function metroLayer() {
  return {
    id: 'metro', type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 11,
    filter: ['all', ['==', ['get', 'class'], 'railway'], ['==', ['get', 'subclass'], 'subway']],
    layout: { 'icon-image': 'metro', 'icon-size': 0.5, 'text-field': NAME, 'text-font': FONT, 'text-size': 12.5, 'text-anchor': 'top', 'text-offset': [0, 0.9], 'text-max-width': 8, 'text-optional': true },
    paint: { 'text-color': '#dfe6ef', 'text-halo-color': LAND, 'text-halo-width': 1.3 },
  };
}

// Подписи заведений: на проде они добавляют шум, поэтому включаются только в варианте «Как сейчас».
function poiLayers() {
  const group = (id, classes, color) => ({
    id, type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 12.5, filter: ['in', ['get', 'class'], ['literal', classes]],
    layout: { 'text-field': NAME, 'text-font': FONT, 'text-size': 12.5, 'text-max-width': 7, 'text-padding': 8 },
    paint: { 'text-color': color, 'text-halo-color': LAND, 'text-halo-width': 1.2 },
  });
  return [
    group('poi-med', ['hospital', 'doctors', 'pharmacy', 'dentist'], '#e87c74'),
    group('poi-culture', ['museum', 'theatre', 'attraction', 'art_gallery', 'cinema'], '#3fc7a0'),
    group('poi-hotel', ['lodging'], '#a48be6'),
    group('poi-shop', ['shop', 'grocery', 'clothing_store', 'restaurant', 'cafe', 'fast_food', 'bank'], '#9aa8bd'),
  ];
}

export function mapStyle({ poi }) {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
    layers: [...baseLayers(), ...labelLayers(), ...(poi ? poiLayers() : []), metroLayer()],
  };
}

// Значок метро рисуем сами: своего набора иконок у подложки нет.
export function addMetroIcon(map) {
  const size = 40;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  c.fillStyle = '#e8352e';
  c.font = `700 ${size - 4}px -apple-system, Arial, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('M', size / 2, size / 2 + 2);
  map.addImage('metro', c.getImageData(0, 0, size, size));
}

export { FONT_BOLD };
