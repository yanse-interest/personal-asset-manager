import { calculateAssetCosts, type AssetCosts } from './calculations';
import type { Asset, Category, CostRecord, LifecycleStatus, RevenueRecord } from './types';

export interface LedgerFacts { assets: Asset[]; categories: Category[]; costs: CostRecord[]; revenues: RevenueRecord[] }
export interface AssetSummary { asset: Asset; category: Category | null; costs: CostRecord[]; revenues: RevenueRecord[]; values: AssetCosts }
export interface LedgerTotals { count: number; totalCostCents: number; revenueCents: number; netCostCents: number }
export interface CategoryInsight { id: string; name: string; count: number; activeCount: number; longest: AssetSummary; totals: LedgerTotals }
export type AssetSort = 'default' | 'day-desc' | 'day-asc' | 'use-desc' | 'use-asc';
const add = (a: number, b: number) => { const value = a + b; if (!Number.isSafeInteger(value)) throw new Error('金额合计超出安全整数范围'); return value; };
export const statusNames: Record<LifecycleStatus, string> = { active: '服役中', retired: '已退役', sold: '已卖出' };
export const statuses: LifecycleStatus[] = ['active', 'retired', 'sold'];
export const sortedCategories = (categories: readonly Category[]) => [...categories].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || a.id.localeCompare(b.id));

export function summarizeAssets(facts: LedgerFacts, today: string): AssetSummary[] {
  const costsById = new Map<string, CostRecord[]>(); const revenuesById = new Map<string, RevenueRecord[]>();
  for (const record of facts.costs) costsById.set(record.assetId, [...(costsById.get(record.assetId) ?? []), record]);
  for (const record of facts.revenues) revenuesById.set(record.assetId, [...(revenuesById.get(record.assetId) ?? []), record]);
  const categoriesById = new Map(facts.categories.map(category => [category.id, category]));
  return facts.assets.map(asset => {
    const costs = costsById.get(asset.id) ?? []; const revenues = revenuesById.get(asset.id) ?? [];
    return { asset, category: asset.categoryId ? categoriesById.get(asset.categoryId) ?? null : null, costs, revenues, values: calculateAssetCosts(asset, costs, revenues, today) };
  }).sort((a, b) => b.asset.purchaseDate.localeCompare(a.asset.purchaseDate) || a.asset.id.localeCompare(b.asset.id));
}

export function ledgerTotals(items: readonly AssetSummary[]): LedgerTotals {
  return items.reduce((sum, item) => ({ count: sum.count + 1, totalCostCents: add(sum.totalCostCents, item.values.totalCostCents), revenueCents: add(sum.revenueCents, item.values.revenueCents), netCostCents: add(sum.netCostCents, item.values.netCostCents) }), { count: 0, totalCostCents: 0, revenueCents: 0, netCostCents: 0 });
}

export function sortAssetSummaries(items: readonly AssetSummary[], sort: AssetSort): AssetSummary[] {
  if (sort === 'default') return [...items];
  const byUse = sort.startsWith('use-');
  const descending = sort.endsWith('-desc');
  const matchingMode = items.filter(item => item.asset.costMode === (byUse ? 'use' : 'day'));
  return matchingMode.sort((left, right) => {
    const leftRatio = byUse ? left.values.costPerUse : left.values.costPerDay;
    const rightRatio = byUse ? right.values.costPerUse : right.values.costPerDay;
    if (leftRatio === null) return rightRatio === null ? 0 : 1;
    if (rightRatio === null) return -1;
    const difference = BigInt(leftRatio.numeratorCents) * BigInt(rightRatio.denominator)
      - BigInt(rightRatio.numeratorCents) * BigInt(leftRatio.denominator);
    if (difference === 0n) return 0;
    const order = difference < 0n ? -1 : 1;
    return descending ? -order : order;
  });
}

export function valueRankingCandidates(items: readonly AssetSummary[]): AssetSummary[] {
  return items.filter(item => item.asset.lifecycleStatus === 'active' || item.asset.endedDate === null || item.asset.endedDate !== item.asset.purchaseDate);
}

export function longestAssetSummaries(items: readonly AssetSummary[], limit = 3): AssetSummary[] {
  return [...items]
    .sort((left, right) => right.values.serviceDays - left.values.serviceDays || left.asset.purchaseDate.localeCompare(right.asset.purchaseDate) || left.asset.id.localeCompare(right.asset.id))
    .slice(0, limit);
}

export function categoryInsights(categories: readonly Category[], items: readonly AssetSummary[]): CategoryInsight[] {
  const groups = sortedCategories(categories).map(category => ({ id: category.id, name: category.name, items: items.filter(item => item.asset.categoryId === category.id) }));
  const uncategorized = items.filter(item => item.asset.categoryId === null);
  if (uncategorized.length > 0) groups.push({ id: 'uncategorized', name: '未分类', items: uncategorized });
  return groups.filter(group => group.items.length > 0).map(group => ({
    id: group.id,
    name: group.name,
    count: group.items.length,
    activeCount: group.items.filter(item => item.asset.lifecycleStatus === 'active').length,
    longest: longestAssetSummaries(group.items, 1)[0]!,
    totals: ledgerTotals(group.items),
  })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'zh-CN') || left.id.localeCompare(right.id));
}
