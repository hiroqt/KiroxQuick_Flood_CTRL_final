import { ncrCityContext } from '../../data/geojson/ncrCityContext';

// One shared projection for the WebGL scene and its accessible SVG fallback.
export function project([lng, lat]: number[]): [number, number] {
  return [(lng - 121.0208) * 23, (lat - 14.5685) * 23];
}
export const cityPieces = ncrCityContext.features.map((feature, index) => ({
  name: feature.properties.name,
  center: project([feature.properties.labelLng, feature.properties.labelLat]),
  polygons: (feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates
  ).map((polygon) => polygon.map((ring) => ring.map(project))),
  color: ['#a8c6ef', '#c2d8f4', '#8fb6ea', '#d2e2f7', '#b5cef2'][index % 5],
}));
