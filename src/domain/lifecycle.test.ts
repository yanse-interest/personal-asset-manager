import { describe, expect, it } from 'vitest';
import { effectiveAsset } from './lifecycle';
import { calculateAssetCosts } from './calculations';
import { activeDailyCostCents, categoryInsights, summarizeAssets } from './ledgers';
import type { Asset } from './types';

const asset: Asset = {
  id: 'expiring', name: '到期好物', purchaseCostCents: 300,
  purchaseDate: '2026-10-01', serviceStartDate: '2026-10-01', expiryDate: '2026-10-03',
  costMode: 'day', usageCount: 3, lifecycleStatus: 'active', endedDate: null,
  categoryId: null, iconId: null, note: null,
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
};

describe('automatic retirement after expiry', () => {
  it('keeps the expiry day in service and retires the next day without rewriting the source', () => {
    expect(effectiveAsset(asset, '2026-10-02')).toBe(asset);
    expect(effectiveAsset(asset, '2026-10-03')).toBe(asset);
    expect(effectiveAsset(asset, '2026-10-04')).toMatchObject({ lifecycleStatus: 'retired', endedDate: '2026-10-03' });
    expect(asset).toMatchObject({ lifecycleStatus: 'active', endedDate: null });
  });

  it.each(['day', 'use'] as const)('freezes elapsed days for expired %s assets', costMode => {
    for (const today of ['2026-10-04', '2026-11-01']) {
      expect(calculateAssetCosts({ ...asset, costMode }, [], [], today)).toMatchObject({
        daysOwned: 3, serviceDays: 3, costDays: 3, costPeriodEnd: '2026-10-03',
        countsDailyCostToday: false, costPerDay: { denominator: 3 }, costPerUse: { denominator: 3 },
      });
    }
  });

  it('uses the same status for ledgers, category counts and daily cost totals', () => {
    const facts = { assets: [asset], categories: [], costs: [], revenues: [] };
    const onExpiry = summarizeAssets(facts, '2026-10-03');
    expect(onExpiry[0]!.asset.lifecycleStatus).toBe('active');
    expect(activeDailyCostCents(onExpiry)).toBe(100);
    const afterExpiry = summarizeAssets(facts, '2026-10-04');
    expect(afterExpiry[0]!.asset.lifecycleStatus).toBe('retired');
    expect(activeDailyCostCents(afterExpiry)).toBe(0);
    expect(categoryInsights([], afterExpiry)[0]!.activeCount).toBe(0);
  });

  it('preserves explicit states, open periods and reminders before service', () => {
    for (const lifecycleStatus of ['pending', 'retired', 'sold'] as const) {
      const explicit = { ...asset, lifecycleStatus };
      expect(effectiveAsset(explicit, '2026-10-04')).toBe(explicit);
    }
    const open = { ...asset, expiryDate: null };
    const reminder = { ...asset, serviceStartDate: '2026-10-04' };
    expect(effectiveAsset(open, '2026-10-05')).toBe(open);
    expect(effectiveAsset(reminder, '2026-10-05')).toBe(reminder);
  });

  it('restores active service when expiry is extended or cleared', () => {
    for (const expiryDate of ['2026-10-10', null]) {
      expect(effectiveAsset({ ...asset, expiryDate }, '2026-10-04').lifecycleStatus).toBe('active');
    }
  });
});
