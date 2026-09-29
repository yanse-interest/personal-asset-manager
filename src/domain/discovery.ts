import { expiryStatus } from './dates';
import type { AssetSummary } from './ledgers';

export function matchesAssetSearch(item: AssetSummary, query: string): boolean {
  const terms = query.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = [item.asset.name, item.category?.name ?? '未分类', item.asset.note ?? '']
    .join(' ').normalize('NFKC').toLocaleLowerCase();
  return terms.every(term => text.includes(term));
}

export interface ExpiryBuckets {
  overdue: AssetSummary[];
  today: AssetSummary[];
  soon: AssetSummary[];
  later: AssetSummary[];
}

export function groupUpcomingExpiries(items: readonly AssetSummary[], today: string): ExpiryBuckets {
  const groups: ExpiryBuckets = { overdue: [], today: [], soon: [], later: [] };
  for (const item of items) {
    if (item.asset.lifecycleStatus !== 'active' && item.asset.lifecycleStatus !== 'pending') continue;
    const status = expiryStatus(item.asset.expiryDate, today);
    if (status.kind === 'past') groups.overdue.push(item);
    else if (status.kind === 'today') groups.today.push(item);
    else if (status.kind === 'future') groups[status.days <= 30 ? 'soon' : 'later'].push(item);
  }
  const byDate = (left: AssetSummary, right: AssetSummary) =>
    left.asset.expiryDate!.localeCompare(right.asset.expiryDate!) || left.asset.name.localeCompare(right.asset.name, 'zh-CN') || left.asset.id.localeCompare(right.asset.id);
  groups.overdue.sort((left, right) => byDate(right, left));
  groups.today.sort(byDate);
  groups.soon.sort(byDate);
  groups.later.sort(byDate);
  return groups;
}
