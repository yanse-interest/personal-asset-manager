import { describe, expect, it } from 'vitest';
import { millisecondsUntilNextLocalDay } from './useToday';

describe('today refresh scheduling', () => {
  it('targets the next local midnight rather than adding 24 hours', () => {
    expect(millisecondsUntilNextLocalDay(new Date(2026, 8, 13, 23, 59, 59, 500))).toBe(500);
    expect(millisecondsUntilNextLocalDay(new Date(2026, 8, 13, 0, 0, 0, 0))).toBe(new Date(2026, 8, 14).getTime() - new Date(2026, 8, 13).getTime());
  });
});
