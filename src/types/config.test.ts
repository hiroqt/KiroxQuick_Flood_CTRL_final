import { describe, expect, it } from 'vitest';
import { DEFAULT_RECENCY_WINDOW_SECONDS } from './config';

describe('config defaults', () => {
  it('defaults the recency window to 21600 seconds (6 hours)', () => {
    expect(DEFAULT_RECENCY_WINDOW_SECONDS).toBe(21600);
  });
});
