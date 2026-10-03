import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Website } from './Website';
// Mapbox GL JS stylesheet — required so the map's controls, popups, and canvas
// render/position correctly (Group 2 engine swap: mapbox-gl replaces maplibre).
import 'mapbox-gl/dist/mapbox-gl.css';
import './styles/layout.css';
import './styles/landing.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <Website />
  </StrictMode>,
);
