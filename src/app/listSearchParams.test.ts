import { describe, expect, it } from 'vitest';
import { readAssetSort, readCategoryFilter, readStatusFilter, updateListSearchParam } from './listSearchParams';

describe('list search params', () => {
  it('restores valid filters and falls back safely for invalid values', () => {
    expect(readStatusFilter(new URLSearchParams('status=retired'), 'active')).toBe('retired');
    expect(readStatusFilter(new URLSearchParams('status=unknown'), 'active')).toBe('active');
    expect(readCategoryFilter(new URLSearchParams('category=kitchen'))).toBe('kitchen');
    expect(readCategoryFilter(new URLSearchParams())).toBe('all');
    expect(readAssetSort(new URLSearchParams('sort=day-desc'))).toBe('day-desc');
    expect(readAssetSort(new URLSearchParams('sort=unknown'))).toBe('default');
  });

  it('keeps other filters while replacing the current history entry query', () => {
    const current = new URLSearchParams('category=kitchen&status=sold');
    expect(updateListSearchParam(current, 'status', 'all', 'active').toString()).toBe('category=kitchen&status=all');
    expect(updateListSearchParam(current, 'status', 'active', 'active').toString()).toBe('category=kitchen');
    expect(updateListSearchParam(current, 'sort', 'use-asc', 'default').toString()).toBe('category=kitchen&status=sold&sort=use-asc');
    expect(current.toString()).toBe('category=kitchen&status=sold');
  });
});
