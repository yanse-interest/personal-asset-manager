import { calculateAssetCosts, type AssetCosts } from './calculations';
import type { Asset, Category, CostRecord, LifecycleStatus, RevenueRecord } from './types';

export interface LedgerFacts { assets: Asset[]; categories: Category[]; costs: CostRecord[]; revenues: RevenueRecord[] }
export interface AssetSummary { asset: Asset; category: Category | null; costs: CostRecord[]; revenues: RevenueRecord[]; values: AssetCosts }
export interface LedgerTotals { count: number; totalCostCents: number; revenueCents: number; netCostCents: number }
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
