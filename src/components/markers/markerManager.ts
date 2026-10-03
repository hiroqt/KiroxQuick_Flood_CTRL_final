// src/components/markers/markerManager.ts
//
// MarkerManager owns the Origin_Marker and Destination_Marker overlays for the
// map (design → Components table: OriginMarker / DestinationMarker, Req 8). It
// enforces the core acceptance criteria:
//   - exactly ONE origin and ONE destination at a time (Req 8.1);
//   - placing a marker whose role already exists MOVES the existing marker
//     (repositions) rather than creating a second one (Req 8.4);
//   - each marker's DOM element differs by SHAPE/ICON, not color alone, and
//     carries an accessible role label (Req 8.2, 8.3, 8.5) — delegated to
//     createMarkerElement.
//
// Testability: MapLibre `Marker`s require a real map + WebGL, which jsdom lacks.
// So the manager depends only on a small structural marker interface and a
// `markerFactory` that builds one from a DOM element. The map handle is passed
// as an opaque `MarkerMap` value forwarded to `marker.addTo`. Tests inject a
// fake factory (recording setLngLat/addTo/remove) and a fake map, exercising all
// the manager logic without a real map.

import { createMarkerElement, type MarkerRole } from './markerElement';

/** Opaque map handle forwarded to `marker.addTo`. Real callers pass the MapLibre map. */
export type MarkerMap = unknown;

/**
 * The minimal subset of the MapLibre `Marker` API the manager uses. Structurally
 * typed so a real `maplibregl.Marker` satisfies it and tests can supply a fake.
 */
export interface MarkerLike {
  /** Sets/moves the marker's position; used both on create and on reposition (Req 8.4). */
  setLngLat(lngLat: [number, number]): this;
  /** Attaches the marker to the map. */
  addTo(map: MarkerMap): this;
  /** Detaches the marker from the map (used by clear). */
  remove(): this;
  /** The DOM element backing the marker (carries the accessible label). */
  getElement?(): HTMLElement;
}

/**
 * Builds a marker from its backing DOM element. Defaults to a real
 * `maplibregl.Marker`; tests inject a fake. Kept as a factory (rather than
 * importing maplibre-gl here) so this module stays jsdom-friendly.
 */
export type MarkerFactory = (element: HTMLElement) => MarkerLike;

/** Options for {@link MarkerManager}. */
export interface MarkerManagerOptions {
  /** The map handle forwarded to `marker.addTo`. */
  map: MarkerMap;
  /** Factory that builds a {@link MarkerLike} from a DOM element (injectable). */
  markerFactory: MarkerFactory;
  /**
   * Document used to build marker elements (defaults to the global `document`).
   * Injectable for testing / SSR safety.
   */
  document?: Document;
}

/** A placed marker plus the DOM element it renders (for label/shape assertions). */
interface PlacedMarker {
  marker: MarkerLike;
  element: HTMLElement;
}

/**
 * Manages exactly one Origin_Marker and one Destination_Marker for a map.
 *
 * Placing a role that already exists repositions the existing marker instead of
 * creating a second one, so there is never more than one of each (Req 8.1, 8.4).
 */
export class MarkerManager {
  private readonly map: MarkerMap;
  private readonly markerFactory: MarkerFactory;
  private readonly doc: Document;

  private readonly placed: Partial<Record<MarkerRole, PlacedMarker>> = {};

  constructor(options: MarkerManagerOptions) {
    this.map = options.map;
    this.markerFactory = options.markerFactory;
    this.doc = options.document ?? document;
  }

  /**
   * Places or moves the Origin_Marker (Req 8.1, 8.4). If an origin already
   * exists, its existing marker is repositioned; otherwise a new one is created
   * with a distinct origin-shaped element carrying the "Origin" label.
   */
  setOrigin(lng: number, lat: number): MarkerLike {
    return this.place('origin', lng, lat);
  }

  /**
   * Places or moves the Destination_Marker (Req 8.1, 8.4). Same single-instance
   * / reposition semantics as {@link setOrigin}, with a distinct
   * destination-shaped element carrying the "Destination" label.
   */
  setDestination(lng: number, lat: number): MarkerLike {
    return this.place('destination', lng, lat);
  }

  /** Removes the Origin_Marker if present. Safe to call when none exists. */
  clearOrigin(): void {
    this.clear('origin');
  }

  /** Removes the Destination_Marker if present. Safe to call when none exists. */
  clearDestination(): void {
    this.clear('destination');
  }

  /** The current Origin_Marker, or undefined if none is placed. */
  getOrigin(): MarkerLike | undefined {
    return this.placed.origin?.marker;
  }

  /** The current Destination_Marker, or undefined if none is placed. */
  getDestination(): MarkerLike | undefined {
    return this.placed.destination?.marker;
  }

  /** The DOM element of the current marker for a role, if placed (for tests/a11y). */
  getElement(role: MarkerRole): HTMLElement | undefined {
    return this.placed[role]?.element;
  }

  /** Removes both markers and clears all state. */
  destroy(): void {
    this.clear('origin');
    this.clear('destination');
  }

  // --- internal ------------------------------------------------------------

  /**
   * Shared place-or-move logic. When the role already has a marker, only its
   * position is updated (reposition, Req 8.4) — no second marker is created
   * (Req 8.1). Otherwise a marker is built from a role-distinct element and
   * added to the map.
   */
  private place(role: MarkerRole, lng: number, lat: number): MarkerLike {
    const existing = this.placed[role];
    if (existing) {
      // Reposition the existing marker; do NOT create a second one (Req 8.1, 8.4).
      existing.marker.setLngLat([lng, lat]);
      return existing.marker;
    }

    const element = createMarkerElement(role, this.doc);
    const marker = this.markerFactory(element);
    marker.setLngLat([lng, lat]).addTo(this.map);

    this.placed[role] = { marker, element };
    return marker;
  }

  /** Removes and forgets the marker for a role, if present. */
  private clear(role: MarkerRole): void {
    const existing = this.placed[role];
    if (!existing) return;
    existing.marker.remove();
    delete this.placed[role];
  }
}
