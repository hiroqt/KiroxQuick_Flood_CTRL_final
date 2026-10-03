import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Mapbox GL JS stylesheet — required so the map's controls, popups, and canvas
// render/position correctly (Group 2 engine swap: mapbox-gl replaces maplibre).
import 'mapbox-gl/dist/mapbox-gl.css';
import './styles/layout.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
