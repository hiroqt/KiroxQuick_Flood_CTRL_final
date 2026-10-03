// src/types/evacuation.ts

import type { GeoLocation } from './flood';

export interface EvacuationCenter {
  id: string;
  location: GeoLocation; // at least location, name, description (Req 16.2)
  name: string;
  description: string;
}
