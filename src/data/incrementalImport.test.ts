import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssetDatabase } from './db';
import { mergeIncrementalImport, parseIncrementalImport } from './incrementalImport';
import type { Asset, RevenueRecord } from '../domain/types';

const now = new Date('2026-09-15T08:00:00.000Z');
const timestamp = now.toISOString();
const asset: Asset = {
  id: '11111111-1111-4111-8111-111111111112', name: '测试球鞋 A',
  purchaseCostCents: 10000, purchaseDate: '2026-09-13', costMode: 'day', usageCount: 0,
  expiryDate: null, note: null, createdAt: timestamp, updatedAt: timestamp,
  categoryId: null, lifecycleStatus: 'retired', endedDate: '2026-09-14', iconId: 'emoji:其他:17',
};
const refundAsset: Asset = {
  ...asset, id: '11111111-1111-4111-8111-111111111113', name: '测试球鞋 B',
  purchaseCostCents: 12000, purchaseDate: '2026-09-13', lifecycleStatus: 'sold', endedDate: '2026-09-14', note: '测试备注',
};
const refund: RevenueRecord = {
  id: '22222222-2222-4222-8222-222222222222', assetId: refundAsset.id,
  amountCents: 12000, date: '2026-09-14', note: '测试回收', createdAt: timestamp, updatedAt: timestamp,
};
const candidate = () => ({
  format: 'large-asset-cost-increment', schemaVersion: 1, exportedAt: timestamp, currency: 'CNY',
  categoryName: '日常球鞋', assets: [{ ...asset }, { ...refundAsset }], costRecords: [], revenueRecords: [{ ...refund }],
});
let database: AssetDatabase;
beforeEach(() => { database = new AssetDatabase(`increment-${crypto.randomUUID()}`); });
afterEach(async () => { database.close(); await database.delete(); });

describe('incremental import', () => {
  it('reuses a matching category, appends assets and keeps existing records', async () => {
    const category = { id: '33333333-3333-4333-8333-333333333333', name: '日常球鞋', createdAt: timestamp, updatedAt: timestamp };
    const existing = { ...asset, id: '44444444-4444-4444-8444-444444444444', name: '旧球鞋', categoryId: category.id };
    await database.categories.add(category); await database.assets.add(existing);
    await mergeIncrementalImport(parseIncrementalImport(JSON.stringify(candidate()), now), database, now);
    expect(await database.categories.count()).toBe(1);
    expect(await database.assets.count()).toBe(3);
    expect((await database.assets.get(asset.id))?.categoryId).toBe(category.id);
    expect(await database.revenueRecords.toArray()).toEqual([refund]);
    expect(await database.assets.get(existing.id)).toEqual(existing);
  });

  it('rejects repeat imports without changing the database', async () => {
    const input = parseIncrementalImport(JSON.stringify(candidate()), now);
    await mergeIncrementalImport(input, database, now);
    await expect(mergeIncrementalImport(input, database, now)).rejects.toThrow('疑似重复');
    expect(await database.assets.count()).toBe(2);
    expect(await database.revenueRecords.count()).toBe(1);
  });

  it('rejects malformed data and rolls back a failed final write', async () => {
    const bad = candidate(); bad.assets[0]!.categoryId = '33333333-3333-4333-8333-333333333333';
    expect(() => parseIncrementalImport(JSON.stringify(bad), now)).toThrow('categoryId');
    const fail = () => { throw new Error('forced failure'); };
    database.revenueRecords.hook('creating').subscribe(fail);
    await expect(mergeIncrementalImport(parseIncrementalImport(JSON.stringify(candidate()), now), database, now)).rejects.toThrow('forced failure');
    database.revenueRecords.hook('creating').unsubscribe(fail);
    expect(await database.assets.count()).toBe(0);
    expect(await database.categories.count()).toBe(0);
  });
});
