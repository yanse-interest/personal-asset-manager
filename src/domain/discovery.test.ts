import { describe, expect, it } from 'vitest';
import { groupUpcomingExpiries, matchesAssetSearch } from './discovery';
import { summarizeAssets } from './ledgers';
import type { Asset, Category } from './types';

const timestamp = '2026-09-29T08:00:00.000Z';
const category: Category = { id: crypto.randomUUID(), name: '数码', createdAt: timestamp, updatedAt: timestamp };
function asset(name: string, expiryDate: string | null, status: Asset['lifecycleStatus'] = 'active', note: string | null = null): Asset {
  return { id: crypto.randomUUID(), name, purchaseCostCents: 10000, purchaseDate: '2026-01-01', serviceStartDate: status === 'pending' ? null : '2026-01-01', costMode: 'day', usageCount: 0, expiryDate, note, categoryId: category.id, lifecycleStatus: status, endedDate: status === 'retired' || status === 'sold' ? '2026-09-01' : null, iconId: null, createdAt: timestamp, updatedAt: timestamp };
}

describe('asset discovery', () => {
  it('finds names, categories and notes with space-separated terms', () => {
    const [item] = summarizeAssets({ assets: [asset('耳机 Pro', null, 'active', '放在书房')], categories: [category], costs: [], revenues: [] }, '2026-09-29');
    expect(matchesAssetSearch(item!, '  耳机   数码  ')).toBe(true);
    expect(matchesAssetSearch(item!, 'pro 书房')).toBe(true);
    expect(matchesAssetSearch(item!, 'ＰＲＯ')).toBe(true);
    expect(matchesAssetSearch(item!, '厨房')).toBe(false);
  });

  it('groups open assets by calendar day, excludes closed assets, and orders dates', () => {
    const entries = [
      asset('昨天', '2026-09-28'), asset('上月', '2026-08-20'), asset('今天', '2026-09-29'),
      asset('三十天', '2026-10-29', 'pending'), asset('三十一天', '2026-10-30'),
      asset('无日期', null), asset('已卖出', '2026-09-28', 'sold'), asset('已退役', '2026-10-01', 'retired'),
    ];
    const summaries = summarizeAssets({ assets: entries, categories: [category], costs: [], revenues: [] }, '2026-09-29');
    const groups = groupUpcomingExpiries(summaries, '2026-09-29');
    expect(groups.overdue.map(item => item.asset.name)).toEqual(['昨天', '上月']);
    expect(groups.today.map(item => item.asset.name)).toEqual(['今天']);
    expect(groups.soon.map(item => item.asset.name)).toEqual(['三十天']);
    expect(groups.later.map(item => item.asset.name)).toEqual(['三十一天']);
  });
});
