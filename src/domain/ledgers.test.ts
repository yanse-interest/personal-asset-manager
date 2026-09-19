import { describe, expect, it } from 'vitest';
import { categoryInsights, ledgerTotals, longestAssetSummaries, sortAssetSummaries, statuses, summarizeAssets, valueRankingCandidates } from './ledgers';
import type { Asset, Category, CostRecord, RevenueRecord } from './types';

const timestamp = '2026-09-13T08:00:00.000Z';
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
const category: Category = { id: '44444444-4444-4444-8444-444444444444', name: '数码', createdAt: timestamp, updatedAt: timestamp };
const assets: Asset[] = ids.map((id, index) => ({ id, name: `资产${index}`, purchaseCostCents: (index + 1) * 10_000, purchaseDate: '2026-09-13', costMode: 'day', usageCount: [2, 1, 0][index]!, expiryDate: null, note: null, categoryId: index === 0 ? category.id : null, lifecycleStatus: statuses[index]!, endedDate: index === 0 ? null : '2026-09-13', iconId: null, createdAt: timestamp, updatedAt: timestamp }));
const costs: CostRecord[] = [{ id: crypto.randomUUID(), assetId: ids[1]!, kind: 'additional', amountCents: 500, date: '2026-09-13', note: null, createdAt: timestamp, updatedAt: timestamp }];
const revenues: RevenueRecord[] = [{ id: crypto.randomUUID(), assetId: ids[2]!, amountCents: 35_000, date: '2026-09-13', note: '出售', createdAt: timestamp, updatedAt: timestamp }];

describe('ledger partitions', () => {
  it('matches whole-library totals across both independent dimensions', () => {
    const summaries = summarizeAssets({ assets, categories: [category], costs, revenues }, '2026-09-15');
    const all = ledgerTotals(summaries);
    const byStatus = statuses.map(status => ledgerTotals(summaries.filter(item => item.asset.lifecycleStatus === status)));
    const byCategory = [category.id, null].map(id => ledgerTotals(summaries.filter(item => item.asset.categoryId === id)));
    for (const partitions of [byStatus, byCategory]) {
      expect(partitions.reduce((sum, item) => ({ count: sum.count + item.count, totalCostCents: sum.totalCostCents + item.totalCostCents, revenueCents: sum.revenueCents + item.revenueCents, netCostCents: sum.netCostCents + item.netCostCents }), { count: 0, totalCostCents: 0, revenueCents: 0, netCostCents: 0 })).toEqual(all);
    }
    expect(all).toEqual({ count: 3, totalCostCents: 60_500, revenueCents: 35_000, netCostCents: 25_500 });
    expect(byStatus[2]?.netCostCents).toBe(-5_000);
    expect(summaries.find(item => item.asset.id === ids[1])?.values.serviceDays).toBe(1);
  });

  it('sorts exact ratios only within the selected observation mode', () => {
    const summaries = summarizeAssets({ assets, categories: [category], costs, revenues }, '2026-09-15');
    expect(sortAssetSummaries(summaries, 'day-desc').map(item => item.asset.id)).toEqual([ids[1], ids[0], ids[2]]);
    expect(sortAssetSummaries(summaries, 'day-asc').map(item => item.asset.id)).toEqual([ids[2], ids[0], ids[1]]);
    const mixedModes = summaries.map((item, index) => ({ ...item, asset: { ...item.asset, costMode: index < 2 ? 'use' as const : 'day' as const } }));
    expect(sortAssetSummaries(mixedModes, 'use-desc').map(item => item.asset.id)).toEqual([ids[1], ids[0]]);
    expect(sortAssetSummaries(mixedModes, 'use-asc').map(item => item.asset.id)).toEqual([ids[0], ids[1]]);
    expect(sortAssetSummaries(mixedModes, 'day-desc').map(item => item.asset.id)).toEqual([ids[2]]);
  });

  it('builds category insights with longest companion and financial totals', () => {
    const summaries = summarizeAssets({ assets, categories: [category], costs, revenues }, '2026-09-15');
    expect(longestAssetSummaries(summaries, 2).map(item => item.asset.id)).toEqual([ids[0], ids[1]]);
    const insights = categoryInsights([category], summaries);
    expect(insights.map(item => item.name)).toEqual(['未分类', '数码']);
    expect(insights[0]).toMatchObject({ id: 'uncategorized', count: 2, activeCount: 0, totals: { totalCostCents: 50_500, revenueCents: 35_000, netCostCents: 15_500 } });
    expect(insights[0]?.longest.asset.id).toBe(ids[1]);
    expect(insights[1]).toMatchObject({ id: category.id, count: 1, activeCount: 1, totals: { netCostCents: 10_000 } });
  });

  it('excludes same-day retired and sold assets from value rankings', () => {
    const summaries = summarizeAssets({ assets, categories: [category], costs, revenues }, '2026-09-15');
    expect(valueRankingCandidates(summaries).map(item => item.asset.id)).toEqual([ids[0]]);
    const retiredWithoutDate = summaries.map(item => item.asset.id === ids[1] ? { ...item, asset: { ...item.asset, endedDate: null } } : item);
    expect(valueRankingCandidates(retiredWithoutDate).map(item => item.asset.id)).toEqual([ids[0], ids[1]]);
  });
});
