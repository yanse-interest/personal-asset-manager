import type { LifecycleStatus } from '../domain/types';

export type StatusFilter = LifecycleStatus | 'all';

const statusFilters = new Set<StatusFilter>(['active', 'retired', 'sold', 'all']);

export function readStatusFilter(searchParams: URLSearchParams, fallback: StatusFilter): StatusFilter {
  const value = searchParams.get('status');
  return value && statusFilters.has(value as StatusFilter) ? value as StatusFilter : fallback;
}

export function readCategoryFilter(searchParams: URLSearchParams): string {
  return searchParams.get('category') || 'all';
}

export function updateListSearchParam(
  searchParams: URLSearchParams,
  name: 'category' | 'status',
  value: string,
  defaultValue: string,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (value === defaultValue) next.delete(name);
  else next.set(name, value);
  return next;
}
