import type { LifecycleStatus } from '../domain/types';
import type { AssetSort } from '../domain/ledgers';

export type StatusFilter = LifecycleStatus | 'all';

const statusFilters = new Set<StatusFilter>(['active', 'retired', 'sold', 'all']);
const assetSorts = new Set<AssetSort>(['default', 'day-desc', 'day-asc', 'use-desc', 'use-asc']);

export function readStatusFilter(searchParams: URLSearchParams, fallback: StatusFilter): StatusFilter {
  const value = searchParams.get('status');
  return value && statusFilters.has(value as StatusFilter) ? value as StatusFilter : fallback;
}

export function readCategoryFilter(searchParams: URLSearchParams): string {
  return searchParams.get('category') || 'all';
}

export function readAssetSort(searchParams: URLSearchParams): AssetSort {
  const value = searchParams.get('sort');
  return value && assetSorts.has(value as AssetSort) ? value as AssetSort : 'default';
}

export function updateListSearchParam(
  searchParams: URLSearchParams,
  name: 'category' | 'status' | 'sort',
  value: string,
  defaultValue: string,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (value === defaultValue) next.delete(name);
  else next.set(name, value);
  return next;
}
