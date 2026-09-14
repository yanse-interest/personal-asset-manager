import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssetDatabase } from './db';
import { AssetConflictError, correctUsageCount, createAsset, deleteAsset, getAssetDeleteSnapshot, incrementUsage, updateAsset } from './assets';
import { MAX_USAGE_COUNT } from '../domain/validation';

const now = new Date('2026-09-13T08:00:00.000Z');
const input = { name: ' 咖啡机 ', purchaseCost: '999.99', purchaseDate: '2026-09-13', costMode: 'use' as const, initialUsageCount: '3', expiryDate: null, note: '' };
let database: AssetDatabase;
beforeEach(() => { database = new AssetDatabase(`assets-${crypto.randomUUID()}`); });
afterEach(async () => { database.close(); await database.delete(); });

describe('asset CRUD', () => {
  it('creates, persists, and edits without overwriting usage count', async () => {
    const created = await createAsset(input, database, now);
    expect(created).toMatchObject({ name: '咖啡机', purchaseCostCents: 99_999, usageCount: 3, note: null });
    const updated = await updateAsset(created.id, created, { ...input, name: '新名称', purchaseCost: '0', costMode: 'day' }, database, new Date('2026-09-14T08:00:00.000Z'));
    expect(updated).toMatchObject({ id: created.id, createdAt: created.createdAt, purchaseCostCents: 0, usageCount: 3 });
    database.close(); database = new AssetDatabase(database.name);
    expect(await database.assets.get(created.id)).toEqual(updated);
  });

  it('rejects stale edits and invalid purchase-date changes', async () => {
    const created = await createAsset({ ...input, purchaseDate: '2026-09-10' }, database, now);
    await database.assets.update(created.id, { name: '另一标签已改名' });
    await expect(updateAsset(created.id, created, input, database, now)).rejects.toBeInstanceOf(AssetConflictError);
    const current = (await database.assets.get(created.id))!;
    await database.costRecords.add({ id: crypto.randomUUID(), assetId: created.id, kind: 'additional', amountCents: 100, date: '2026-09-11', note: null, createdAt: now.toISOString(), updatedAt: now.toISOString() });
    await expect(updateAsset(created.id, current, { ...input, purchaseDate: '2026-09-12' }, database, now)).rejects.toThrow('2026-09-11');
  });

  it('cascades only the confirmed asset', async () => {
    const first = await createAsset(input, database, now); const second = await createAsset({ ...input, name: '打印机' }, database, now);
    for (const asset of [first, second]) {
      await database.costRecords.add({ id: crypto.randomUUID(), assetId: asset.id, kind: 'consumable', amountCents: 100, date: '2026-09-13', note: null, createdAt: now.toISOString(), updatedAt: now.toISOString() });
      await database.revenueRecords.add({ id: crypto.randomUUID(), assetId: asset.id, amountCents: 50, date: '2026-09-13', note: null, createdAt: now.toISOString(), updatedAt: now.toISOString() });
    }
    await deleteAsset((await getAssetDeleteSnapshot(first.id, database))!, database);
    expect(await database.assets.get(first.id)).toBeUndefined(); expect(await database.assets.get(second.id)).toBeDefined();
    expect(await database.costRecords.where('assetId').equals(first.id).count()).toBe(0);
    expect(await database.costRecords.where('assetId').equals(second.id).count()).toBe(1);
  });

  it('refuses deletion when a related record changed after confirmation', async () => {
    const created = await createAsset(input, database, now); const snapshot = await getAssetDeleteSnapshot(created.id, database);
    await database.revenueRecords.add({ id: crypto.randomUUID(), assetId: created.id, amountCents: 10, date: '2026-09-13', note: null, createdAt: now.toISOString(), updatedAt: now.toISOString() });
    await expect(deleteAsset(snapshot!, database)).rejects.toBeInstanceOf(AssetConflictError);
    expect(await database.assets.get(created.id)).toBeDefined();
  });

  it('enforces the shared 5,000-record capacity on create', async () => {
    const created = await createAsset(input, database, now);
    await database.costRecords.bulkAdd(Array.from({ length: 4_999 }, (_, index) => ({ id: crypto.randomUUID(), assetId: created.id, kind: 'additional' as const, amountCents: 1, date: '2026-09-13', note: `记录${index}`, createdAt: now.toISOString(), updatedAt: now.toISOString() })));
    await expect(createAsset({ ...input, name: '超限资产' }, database, now)).rejects.toThrow('5000');
  });

  it('rolls back the transaction when deletion fails', async () => {
    const created = await createAsset(input, database, now);
    await database.costRecords.add({ id: crypto.randomUUID(), assetId: created.id, kind: 'additional', amountCents: 1, date: '2026-09-13', note: null, createdAt: now.toISOString(), updatedAt: now.toISOString() });
    const snapshot = await getAssetDeleteSnapshot(created.id, database);
    const fail = () => { throw new Error('forced failure'); };
    database.assets.hook('deleting').subscribe(fail);
    await expect(deleteAsset(snapshot!, database)).rejects.toThrow('forced failure');
    database.assets.hook('deleting').unsubscribe(fail);
    expect(await database.assets.get(created.id)).toBeDefined();
    expect(await database.costRecords.where('assetId').equals(created.id).count()).toBe(1);
  });
});


describe('usage count writes', () => {
  it('rejects a stale +1 after ending service but permits historical correction and reopening', async () => {
    const created = await createAsset(input, database, now);
    const ended = await updateAsset(created.id, created, { ...input, lifecycleStatus: 'sold', endedDate: '2026-09-13', salePrice: '1' }, database, now);
    await expect(incrementUsage(created.id, database, now)).rejects.toThrow('已结束服役');
    expect((await database.assets.get(created.id))?.usageCount).toBe(3);
    const corrected = await correctUsageCount(created.id, 3, '4', database, now);
    expect(corrected.usageCount).toBe(4);
    const reopened = await updateAsset(created.id, corrected, { ...input, lifecycleStatus: 'active', endedDate: null }, database, now);
    expect(reopened.endedDate).toBeNull();
    expect((await incrementUsage(created.id, database, now)).usageCount).toBe(5);
    expect(ended.lifecycleStatus).toBe('sold');
  });

  it('requires a positive sale price and writes exactly one revenue on transition', async () => {
    const created = await createAsset(input, database, now);
    await expect(updateAsset(created.id, created, { ...input, lifecycleStatus: 'sold', endedDate: '2026-09-13' }, database, now)).rejects.toThrow('卖价必须填写');
    await expect(updateAsset(created.id, created, { ...input, lifecycleStatus: 'sold', endedDate: '2026-09-13', salePrice: '0' }, database, now)).rejects.toThrow();
    expect(await database.revenueRecords.count()).toBe(0);
    const sold = await updateAsset(created.id, created, { ...input, lifecycleStatus: 'sold', endedDate: '2026-09-13', salePrice: '2' }, database, now);
    expect((await database.revenueRecords.toArray())[0]).toMatchObject({ assetId: created.id, amountCents: 200, date: '2026-09-13', note: '出售' });
    await updateAsset(created.id, sold, { ...input, lifecycleStatus: 'sold', endedDate: '2026-09-13' }, database, now);
    expect(await database.revenueRecords.count()).toBe(1);
  });

  it('creates a sold asset and sale revenue atomically, including failure rollback', async () => {
    await expect(createAsset({ ...input, lifecycleStatus: 'sold', endedDate: '2026-09-13' }, database, now)).rejects.toThrow('卖价必须填写');
    expect(await database.assets.count()).toBe(0);
    const fail = () => { throw new Error('sale insert failed'); };
    database.revenueRecords.hook('creating').subscribe(fail);
    await expect(createAsset({ ...input, lifecycleStatus: 'sold', endedDate: '2026-09-13', salePrice: '5' }, database, now)).rejects.toThrow('sale insert failed');
    database.revenueRecords.hook('creating').unsubscribe(fail);
    expect(await database.assets.count()).toBe(0);
    const sold = await createAsset({ ...input, lifecycleStatus: 'sold', endedDate: '2026-09-13', salePrice: '5' }, database, now);
    expect((await database.revenueRecords.toArray())[0]).toMatchObject({ assetId: sold.id, amountCents: 500 });
  });

  it('rolls back a sale transition if revenue insert fails and reserves one capacity slot', async () => {
    const created = await createAsset(input, database, now);
    const fail = () => { throw new Error('sale insert failed'); };
    database.revenueRecords.hook('creating').subscribe(fail);
    await expect(updateAsset(created.id, created, { ...input, lifecycleStatus: 'sold', endedDate: '2026-09-13', salePrice: '5' }, database, now)).rejects.toThrow('sale insert failed');
    database.revenueRecords.hook('creating').unsubscribe(fail);
    expect(await database.assets.get(created.id)).toEqual(created);
    await database.costRecords.bulkAdd(Array.from({ length: 4_999 }, () => ({ id: crypto.randomUUID(), assetId: created.id, kind: 'additional' as const, amountCents: 1, date: '2026-09-13', note: null, createdAt: now.toISOString(), updatedAt: now.toISOString() })));
    await expect(updateAsset(created.id, created, { ...input, lifecycleStatus: 'sold', endedDate: '2026-09-13', salePrice: '5' }, database, now)).rejects.toThrow('5000');
    expect((await database.assets.get(created.id))?.lifecycleStatus).toBe('active');
  });
  it('increments atomically across two database connections', async () => {
    const created = await createAsset({ ...input, initialUsageCount: '0' }, database, now);
    const otherConnection = new AssetDatabase(database.name);
    try {
      await Promise.all([
        incrementUsage(created.id, database, new Date('2026-09-13T08:01:00.000Z')),
        incrementUsage(created.id, otherConnection, new Date('2026-09-13T08:02:00.000Z')),
      ]);
      expect((await database.assets.get(created.id))?.usageCount).toBe(2);
    } finally {
      otherConnection.close();
    }
  });

  it('rejects increments for day mode, deleted assets, and the maximum count', async () => {
    const dayAsset = await createAsset({ ...input, name: '按天资产', costMode: 'day' }, database, now);
    await expect(incrementUsage(dayAsset.id, database, now)).rejects.toBeInstanceOf(AssetConflictError);
    expect((await database.assets.get(dayAsset.id))?.usageCount).toBe(0);

    const maxAsset = await createAsset({ ...input, name: '达到上限', initialUsageCount: String(MAX_USAGE_COUNT) }, database, now);
    await expect(incrementUsage(maxAsset.id, database, now)).rejects.toThrow('上限');
    expect((await database.assets.get(maxAsset.id))?.usageCount).toBe(MAX_USAGE_COUNT);

    const deleted = await createAsset({ ...input, name: '已删除' }, database, now);
    await database.assets.delete(deleted.id);
    await expect(incrementUsage(deleted.id, database, now)).rejects.toThrow('不存在或已删除');
  });

  it('corrects to an absolute nonnegative integer and rejects invalid values', async () => {
    const created = await createAsset(input, database, now);
    const corrected = await correctUsageCount(created.id, 3, '0', database, new Date('2026-09-13T08:03:00.000Z'));
    expect(corrected.usageCount).toBe(0);
    await expect(correctUsageCount(created.id, 0, '-1', database, now)).rejects.toThrow('非负整数');
    await expect(correctUsageCount(created.id, 0, '1.5', database, now)).rejects.toThrow('非负整数');
    expect((await database.assets.get(created.id))?.usageCount).toBe(0);
  });

  it('rejects a stale correction after another page increments', async () => {
    const created = await createAsset(input, database, now);
    await incrementUsage(created.id, database, new Date('2026-09-13T08:04:00.000Z'));
    await expect(correctUsageCount(created.id, created.usageCount, '8', database, now)).rejects.toBeInstanceOf(AssetConflictError);
    expect((await database.assets.get(created.id))?.usageCount).toBe(4);
  });

  it('does not let an old asset edit overwrite an increment', async () => {
    const created = await createAsset(input, database, now);
    await incrementUsage(created.id, database, new Date('2026-09-13T08:05:00.000Z'));
    await expect(updateAsset(created.id, created, { ...input, name: '旧页面修改' }, database, new Date('2026-09-13T08:06:00.000Z'))).rejects.toBeInstanceOf(AssetConflictError);
    expect((await database.assets.get(created.id))?.usageCount).toBe(4);
  });
});
