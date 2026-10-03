import mapboxgl from 'mapbox-gl';
import type { CameraMarkerFactory } from './cameraMarkerManager';

export const mapboxCameraMarkerFactory: CameraMarkerFactory = {
  marker: (element) => new mapboxgl.Marker({ element }),
  popup: () => new mapboxgl.Popup({
    className: 'baharoute-camera-map-popup',
    closeButton: true,
    closeOnClick: true,
    offset: 18,
    maxWidth: 'min(360px, calc(100vw - 32px))',
  }),
};
