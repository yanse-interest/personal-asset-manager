import { describe, expect, it } from 'vitest';
import { calculateAssetCosts } from './calculations';
import { activeDailyCostCents, summarizeAssets } from './ledgers';
import { formatRatio } from './money';
import type { Asset } from './types';

const rent: Asset = {
  id: 'rent', name: '两年房租', purchaseCostCents: 3_360_000,
  purchaseDate: '2026-10-01', serviceStartDate: '2026-10-01', expiryDate: '2028-09-30',
  lifecycleStatus: 'active', endedDate: null, costMode: 'day', usageCount: 0,
  categoryId: null, iconId: null, note: null,
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
};
const calculate = (asset: Asset, today: string) => calculateAssetCosts(asset, [], [], today);
const daily = (assets: Asset[], today: string) => activeDailyCostCents(summarizeAssets({ assets, categories: [], costs: [], revenues: [] }, today));

describe('daily costs within their calendar periods', () => {
  it('spreads two years of rent across the whole period, including leap day', () => {
    for (const today of ['2026-10-01', '2026-10-09', '2027-10-01', '2028-09-30', '2028-10-01']) {
      const values = calculate(rent, today);
      expect(values.costPerDay).toEqual({ numeratorCents: 3_360_000, denominator: 731 });
      expect(values.costDays).toBe(731);
      expect(formatRatio(values.costPerDay!.numeratorCents, values.costPerDay!.denominator)).toBe('¥45.96');
    }
    expect(calculate(rent, '2026-10-09').serviceDays).toBe(9);
    expect(calculate({ ...rent, expiryDate: '2027-09-30' }, '2026-10-09').costDays).toBe(365);
  });

  it('includes both endpoints and excludes dates before and after the period', () => {
    const short = { ...rent, purchaseCostCents: 300, expiryDate: '2026-10-03' };
    for (const today of ['2026-10-01', '2026-10-02', '2026-10-03']) expect(daily([short], today)).toBe(100);
    expect(daily([short], '2026-09-30')).toBe(0);
    expect(daily([short], '2026-10-04')).toBe(0);
    expect(daily([{ ...short, expiryDate: '2026-10-01' }], '2026-10-01')).toBe(300);
  });

  it('only adds overlapping costs for today and rounds the final sum once', () => {
    const first = { ...rent, purchaseCostCents: 1, expiryDate: '2026-10-02' };
    const second = { ...first, id: 'second', serviceStartDate: '2026-10-02', expiryDate: '2026-10-03' };
    const expired = { ...rent, id: 'expired', purchaseDate: '2026-09-01', serviceStartDate: '2026-09-01', expiryDate: '2026-09-30' };
    expect(daily([first, second, expired], '2026-10-02')).toBe(1);
    expect(daily([first, second, expired], '2026-10-03')).toBe(1);
    expect(daily([first, second, expired], '2026-10-04')).toBe(0);
  });

  it('keeps open-ended costs elapsed and excludes closed, pending and use-mode assets', () => {
    const open = { ...rent, expiryDate: null, purchaseCostCents: 900 };
    expect(calculate(open, '2026-10-09').costPerDay).toEqual({ numeratorCents: 900, denominator: 9 });
    expect(daily([open], '2026-10-09')).toBe(100);
    const sold = { ...rent, lifecycleStatus: 'sold' as const, endedDate: '2026-10-03' };
    expect(calculate(sold, '2026-10-09').costDays).toBe(3);
    expect(daily([sold, { ...rent, lifecycleStatus: 'retired', endedDate: '2026-10-03' }, { ...rent, lifecycleStatus: 'pending', serviceStartDate: null }, { ...rent, costMode: 'use' }], '2026-10-02')).toBe(0);
    const byUse = calculate({ ...open, costMode: 'use', expiryDate: '2028-09-30', usageCount: 3 }, '2026-10-09');
    expect(byUse.costPerDay!.denominator).toBe(9);
    expect(byUse.costPerUse).toEqual({ numeratorCents: 900, denominator: 3 });
  });

  it('treats a reminder before service starts as open-ended without inflating today', () => {
    const delayed = { ...rent, expiryDate: '2026-10-02', serviceStartDate: '2026-10-03', purchaseCostCents: 900 };
    expect(calculate(delayed, '2026-10-05').costPerDay!.denominator).toBe(3);
    expect(daily([delayed], '2026-10-05')).toBe(300);
    expect(daily([delayed], '2026-10-02')).toBe(0);
  });
});
