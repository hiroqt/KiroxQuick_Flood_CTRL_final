// src/data/historical/historicalFloodEvidence.ts
//
// ⚠️ HISTORICAL | DEMO / RESEARCH USE ONLY | NOT CURRENT CONDITIONS ⚠️
//
// The 15 historical flood-evidence items transcribed VERBATIM from the research
// report at docs/baharoute-historical-flood-evidence.md (the single source of
// truth). No values are invented: fields the report left blank are omitted or
// null, and `sourceUrl` is `null` for every item because the report's
// source_url table cells are blank.
//
// Coordinates are assigned ONLY to EXACT/HIGH-precision items, from a small
// curated NCR point table below (well-known roads/barangays named in the
// report). APPROXIMATE / CITY_ONLY items get NO coordinate — we never fabricate
// a point when the report's precision is insufficient (per the report's own
// caveat that CITY_ONLY items "should not be assigned to arbitrary
// sub-locations").
//
// This dataset is CONTEXT ONLY and must never affect current flood risk,
// rainfall, community reports, official closures, or route passability.

import type {
  HistoricalFloodEvidence,
  HistoricalLocationPrecision,
} from '../../types/historicalEvidence';
import { precisionAllowsPoint } from '../../types/historicalEvidence';

/** Event grouping metadata (six events in the report). */
export interface HistoricalEventMeta {
  readonly id: string;
  readonly label: string;
  readonly year: number;
}

export const HISTORICAL_EVENTS: readonly HistoricalEventMeta[] = [
  { id: 'ondoy-2009', label: 'Typhoon Ondoy / Ketsana — 2009', year: 2009 },
  { id: 'habagat-2012', label: 'Habagat Southwest Monsoon — 2012', year: 2012 },
  { id: 'mario-2014', label: 'Typhoon Mario / Fung-wong — 2014', year: 2014 },
  { id: 'ompong-2018', label: 'Typhoon Ompong / Mangkhut — 2018', year: 2018 },
  { id: 'ulysses-2020', label: 'Typhoon Ulysses / Vamco — 2020', year: 2020 },
  { id: 'carina-2024', label: 'Typhoon Carina / Enhanced Habagat — 2024', year: 2024 },
];

/**
 * Curated coordinates `[lng, lat]` for the EXACT/HIGH items only, keyed by
 * evidence id. These are approximate public locations of the well-known
 * roads/barangays NAMED in the report — used purely to place a historical
 * marker; they assert nothing about current conditions. Items absent here
 * (APPROXIMATE / CITY_ONLY) are intentionally never mapped to a point.
 */
const RESOLVED_POINTS: Readonly<Record<string, readonly [number, number]>> = {
  'hist-1': [121.0963, 14.6388], // Marikina River gauging station (HIGH)
  'hist-2': [121.102, 14.643], // Provident Village, Marikina (EXACT)
  'hist-3': [121.0906, 14.6902], // Brgy. Silangan near Batasan, QC (HIGH)
  'hist-4': [121.0928, 14.6512], // Brgy. Tumana / Marikina River (HIGH)
  'hist-5': [121.0782, 14.7262], // Regalado Hwy / Greater Lagro, QC (EXACT)
  'hist-8': [120.9812, 14.573], // Roxas Blvd, Pedro Gil–Quirino, Manila (EXACT)
  'hist-9': [121.0344, 14.5774], // Poblacion, Mandaluyong (EXACT)
  'hist-10': [120.9855, 14.6072], // España Blvd / Taft-area corridor, Manila (EXACT)
  'hist-11': [121.0353, 14.6571], // EDSA-Muñoz, Quezon City (EXACT)
  'hist-12': [120.9731, 14.6972], // MacArthur Hwy, Dalandanan, Valenzuela (EXACT)
  'hist-14': [120.9942, 14.6095], // España Boulevard, Manila (EXACT)
};

/** Raw per-item fields transcribed from the report (pre-coordinate assignment). */
type RawItem = Omit<HistoricalFloodEvidence, 'coordinates' | 'provenance'>;

const RAW: readonly RawItem[] = [
  // --- Typhoon Ondoy / Ketsana — 2009 (Items 1–3) ---
  {
    id: 'hist-1',
    title: 'Marikina River reaches 21.5m during Ondoy',
    sourceName: 'Philippine Daily Inquirer',
    sourceUrl: null,
    publicationDate: '2022-07-10',
    eventDate: '2009-09-26',
    city: 'Marikina City',
    locationDetail: 'Marikina River gauging station',
    floodCondition: 'River exceeded critical level',
    reportedDepth: '21.5m river level',
    passability: 'IMPASSABLE',
    locationPrecision: 'HIGH',
    eventId: 'ondoy-2009',
    eventLabel: 'Typhoon Ondoy / Ketsana — 2009',
    eventYear: 2009,
  },
  {
    id: 'hist-2',
    title: '8 dead in Provident Village, Marikina City',
    sourceName: 'GMA News',
    sourceUrl: null,
    publicationDate: '2009 (archival)',
    eventDate: '2009-09-26',
    city: 'Marikina City',
    locationDetail: 'Provident Village',
    floodCondition: 'Rooftop-level submersion',
    reportedDepth: '~7.3m / 24 ft',
    passability: 'IMPASSABLE',
    locationPrecision: 'EXACT',
    eventId: 'ondoy-2009',
    eventLabel: 'Typhoon Ondoy / Ketsana — 2009',
    eventYear: 2009,
  },
  {
    id: 'hist-3',
    title: 'Over 100 killed — 36 dead in Brgy. Silangan, QC',
    sourceName: 'GMA News',
    sourceUrl: null,
    publicationDate: '2009 (archival)',
    eventDate: '2009-09-26',
    city: 'Quezon City',
    locationDetail: 'Brgy. Silangan, near Batasan Pambansa',
    floodCondition: 'Severe flooding, mass casualties',
    reportedDepth: 'Not specified',
    passability: 'IMPASSABLE',
    locationPrecision: 'HIGH',
    eventId: 'ondoy-2009',
    eventLabel: 'Typhoon Ondoy / Ketsana — 2009',
    eventYear: 2009,
  },
  // --- Habagat Southwest Monsoon — 2012 (Items 4–6) ---
  {
    id: 'hist-4',
    title: '23,000 residents evacuated as Marikina River swells',
    sourceName: 'GMA News',
    sourceUrl: null,
    publicationDate: '2012 (archival)',
    eventDate: '2012-08-07',
    city: 'Marikina City',
    locationDetail: 'Marikina River; Brgy. Tumana, Industrial Valley, Nangka, Provident Village',
    floodCondition: 'Severe flooding, mass evacuation',
    reportedDepth: '20.6m river level',
    passability: 'IMPASSABLE',
    locationPrecision: 'HIGH',
    eventId: 'habagat-2012',
    eventLabel: 'Habagat Southwest Monsoon — 2012',
    eventYear: 2012,
  },
  {
    id: 'hist-5',
    title: 'La Mesa Dam overflow floods Greater Lagro, QC',
    sourceName: 'Wikipedia (citing multiple sources)',
    sourceUrl: null, // report cell: "Source: wikipedia.org" — no usable URL
    publicationDate: undefined, // report cell: "—"
    eventDate: '2012-08-07',
    city: 'Quezon City',
    locationDetail: 'Regalado Highway / Brgy. Greater Lagro; Lagro High School',
    floodCondition: 'Submerged ~4m from dam overflow',
    reportedDepth: '~4m / 13 ft',
    passability: 'IMPASSABLE',
    locationPrecision: 'EXACT',
    eventId: 'habagat-2012',
    eventLabel: 'Habagat Southwest Monsoon — 2012',
    eventYear: 2012,
  },
  {
    id: 'hist-6',
    title: 'NDRRMC SitRep No. 7 — 129 roads impassable',
    sourceName: 'NDRRMC',
    sourceUrl: null,
    publicationDate: '2012-08-09',
    eventDate: '2012-08-06 to 2012-08-09',
    city: 'NCR-wide',
    locationDetail: '129 roads, 5 bridges across NCR',
    floodCondition: 'Impassable to all vehicle types',
    reportedDepth: 'Up to 3m in some areas',
    passability: 'IMPASSABLE',
    locationPrecision: 'APPROXIMATE',
    eventId: 'habagat-2012',
    eventLabel: 'Habagat Southwest Monsoon — 2012',
    eventYear: 2012,
  },
  // --- Typhoon Ulysses / Vamco — 2020 (Items 7–9) ---
  {
    id: 'hist-7',
    title: 'EDSA at Marikina Bridge unpassable during Ulysses',
    sourceName: 'DPWH / UNDRR Report',
    sourceUrl: null,
    publicationDate: '2022 (UNDRR report)',
    eventDate: '2020-11-11 to 2020-11-12',
    city: 'Marikina City / Pasig boundary',
    locationDetail: 'EDSA at Marikina Bridge',
    floodCondition: 'Unpassable main roadway',
    reportedDepth: 'Not specified (river at 21.73m)',
    passability: 'IMPASSABLE',
    locationPrecision: 'APPROXIMATE',
    eventId: 'ulysses-2020',
    eventLabel: 'Typhoon Ulysses / Vamco — 2020',
    eventYear: 2020,
  },
  {
    id: 'hist-8',
    title: 'Roxas Blvd (Pedro Gil–Quirino) knee-deep flooding',
    sourceName: 'NDRRMC SitRep No. 4',
    sourceUrl: null,
    publicationDate: '2020-11-14',
    eventDate: '2020-11-12',
    city: 'Manila',
    locationDetail: 'Roxas Blvd, Pedro Gil to Quirino, both sides',
    floodCondition: 'Knee-deep flooding both sides',
    reportedDepth: 'Knee-deep',
    passability: 'IMPASSABLE',
    locationPrecision: 'EXACT',
    eventId: 'ulysses-2020',
    eventLabel: 'Typhoon Ulysses / Vamco — 2020',
    eventYear: 2020,
  },
  {
    id: 'hist-9',
    title: 'Poblacion Mandaluyong streets unpassable',
    sourceName: 'NDRRMC SitRep No. 4',
    sourceUrl: null,
    publicationDate: '2020-11-14',
    eventDate: '2020-11-12',
    city: 'Mandaluyong City',
    locationDetail:
      'Poblacion (Sts. 125, 123, Lerma, 3rd St. Dulo, Court, 4th St. Dulo, 2nd St. Dulo)',
    floodCondition: 'Unpassable',
    reportedDepth: 'Not specified',
    passability: 'IMPASSABLE',
    locationPrecision: 'EXACT',
    eventId: 'ulysses-2020',
    eventLabel: 'Typhoon Ulysses / Vamco — 2020',
    eventYear: 2020,
  },
  // --- Typhoon Carina / Enhanced Habagat — 2024 (Items 10–12) ---
  {
    id: 'hist-10',
    title: 'Manila declares state of calamity — chest-deep floods',
    sourceName: 'GMA News',
    sourceUrl: null,
    publicationDate: '2024-07-26',
    eventDate: '2024-07-24',
    city: 'Manila',
    locationDetail:
      'Finance Rd, Nakpil, Kalaw, Padre Faura along Taft Ave, UN Ave, Ayala, España Blvd',
    floodCondition: 'Chest-deep floods',
    reportedDepth: 'Chest-deep',
    passability: 'IMPASSABLE',
    locationPrecision: 'EXACT',
    eventId: 'carina-2024',
    eventLabel: 'Typhoon Carina / Enhanced Habagat — 2024',
    eventYear: 2024,
  },
  {
    id: 'hist-11',
    title: 'EDSA-Muñoz waist-deep, impassable',
    sourceName: 'GMA News',
    sourceUrl: null,
    publicationDate: '2024-07-24',
    eventDate: '2024-07-24',
    city: 'Quezon City',
    locationDetail: 'EDSA-Muñoz (NB & SB lanes, bus carousel)',
    floodCondition: 'Waist-deep, standstill traffic',
    reportedDepth: 'Waist-deep',
    passability: 'IMPASSABLE',
    locationPrecision: 'EXACT',
    eventId: 'carina-2024',
    eventLabel: 'Typhoon Carina / Enhanced Habagat — 2024',
    eventYear: 2024,
  },
  {
    id: 'hist-12',
    title: 'Valenzuela MacArthur Hwy — half tire-deep, passable',
    sourceName: 'GMA News',
    sourceUrl: null,
    publicationDate: '2024-07-25',
    eventDate: '2024-07-25',
    city: 'Valenzuela City',
    locationDetail: 'MacArthur Hwy at BDO Dalandanan, Wilcon-Cuevas Dalandanan',
    floodCondition: 'Half tire-deep',
    reportedDepth: 'Half tire-deep',
    passability: 'PASSABLE',
    locationPrecision: 'EXACT',
    eventId: 'carina-2024',
    eventLabel: 'Typhoon Carina / Enhanced Habagat — 2024',
    eventYear: 2024,
  },
  // --- Typhoon Mario / Fung-wong — 2014 (Items 13–14) ---
  {
    id: 'hist-13',
    title: 'Marikina River reaches 18–20m, 27K evacuated',
    sourceName: 'Philippine Daily Inquirer / Wikipedia',
    sourceUrl: null,
    publicationDate: '2014-09-19 (Inquirer)',
    eventDate: '2014-09-19',
    city: 'Marikina City',
    locationDetail: 'Marikina River; multiple barangays',
    floodCondition: 'Submerged, state of calamity',
    reportedDepth: '18–20m river level; up to 10 ft in areas',
    passability: 'IMPASSABLE',
    locationPrecision: 'CITY_ONLY',
    eventId: 'mario-2014',
    eventLabel: 'Typhoon Mario / Fung-wong — 2014',
    eventYear: 2014,
  },
  {
    id: 'hist-14',
    title: 'España Boulevard rendered entirely impassable',
    sourceName: 'GMA News',
    sourceUrl: null,
    publicationDate: '2014-09-19 (archival)',
    eventDate: '2014-09-19',
    city: 'Manila',
    locationDetail: 'España Boulevard (entire stretch)',
    floodCondition: 'Entirely impassable',
    reportedDepth: 'Not specified',
    passability: 'IMPASSABLE',
    locationPrecision: 'EXACT',
    eventId: 'mario-2014',
    eventLabel: 'Typhoon Mario / Fung-wong — 2014',
    eventYear: 2014,
  },
  // --- Typhoon Ompong / Mangkhut — 2018 (Item 15) ---
  {
    id: 'hist-15',
    title: 'Tornado in Marikina; Roxas Blvd storm surge during Ompong',
    sourceName: 'Wikipedia (citing Philippine sources) / GMA News',
    sourceUrl: null, // report cell: " / " — no usable URL
    publicationDate: '2018-11-01 (GMA)',
    eventDate: '2018-09-14 to 2018-09-15',
    city: 'Marikina City / Manila',
    locationDetail: 'Marikina (tornado); Roxas Boulevard (storm surge)',
    floodCondition: 'Widespread urban flooding, tornado, storm surge',
    reportedDepth: 'Not specified',
    passability: 'UNKNOWN',
    locationPrecision: 'CITY_ONLY',
    eventId: 'ompong-2018',
    eventLabel: 'Typhoon Ompong / Mangkhut — 2018',
    eventYear: 2018,
  },
];

/**
 * The 15 historical flood-evidence items. Coordinates are attached ONLY for
 * EXACT/HIGH items that have a curated point; everything else is left without a
 * coordinate (never fabricated). Provenance is always HISTORICAL_WEB_EVIDENCE.
 */
export const historicalFloodEvidence: readonly HistoricalFloodEvidence[] = RAW.map((raw) => {
  const point = precisionAllowsPoint(raw.locationPrecision) ? RESOLVED_POINTS[raw.id] : undefined;
  return {
    ...raw,
    coordinates: point,
    provenance: 'HISTORICAL_WEB_EVIDENCE' as const,
  };
});

/** Distinct cities present in the dataset (for the city filter), in first-seen order. */
export const historicalCities: readonly string[] = Array.from(
  new Set(historicalFloodEvidence.map((e) => e.city).filter((c): c is string => Boolean(c))),
);

/** Distinct precision categories present (for the precision filter). */
export const historicalPrecisions: readonly HistoricalLocationPrecision[] = Array.from(
  new Set(historicalFloodEvidence.map((e) => e.locationPrecision)),
);
