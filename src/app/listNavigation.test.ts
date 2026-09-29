import { describe, expect, it } from 'vitest';
import { listNavigationState, readListPath } from './listNavigation';

describe('list navigation context', () => {
  it('keeps dashboard, category ledger and status ledger filters', () => {
    expect(listNavigationState('/', '?category=kitchen&status=retired')).toEqual({ listPath: '/?category=kitchen&status=retired' });
    expect(listNavigationState('/categories/abc', '?status=active')).toEqual({ listPath: '/categories/abc?status=active' });
    expect(listNavigationState('/ledgers/sold', '?category=kitchen')).toEqual({ listPath: '/ledgers/sold?category=kitchen' });
    expect(listNavigationState('/expiries', '')).toEqual({ listPath: '/expiries' });
    expect(listNavigationState('/', '?q=%E8%80%B3%E6%9C%BA')).toEqual({ listPath: '/?q=%E8%80%B3%E6%9C%BA' });
  });

  it('falls back to the dashboard for missing or unsafe state', () => {
    expect(readListPath(null)).toBe('/');
    expect(readListPath({ listPath: '//example.com' })).toBe('/');
    expect(readListPath({ listPath: '/assets/abc' })).toBe('/');
    expect(readListPath({ listPath: '/categories/abc?status=retired' })).toBe('/categories/abc?status=retired');
  });
});
