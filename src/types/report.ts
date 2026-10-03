// src/types/report.ts

import type { FloodItemMetadata, FloodState } from './flood';

/** Community report is a distinct category (Req 14.1). */
export interface CommunityReport {
  id: string;
  state: FloodState;
  passable?: boolean;
  metadata: FloodItemMetadata; // dataType === 'COMMUNITY_REPORT'
  /** Non-verified community reports are marked UNCONFIRMED (Req 14.3, 14.4). */
}
