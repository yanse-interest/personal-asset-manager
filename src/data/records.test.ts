import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { calculateAssetCosts } from '../domain/calculations';
import { AssetDatabase } from './db';
import { createAsset } from './assets';
import { RecordConflictError, createRecord, deleteRecord, getCostRecord, getRevenueRecord, updateCostRecord, updateRevenueRecord } from './records';

const now = new Date('2026-09-13T08:00:00.000Z');
let database: AssetDatabase;
beforeEach(() => { database = new AssetDatabase(`records-${crypto.randomUUID()}`); });
afterEach(async () => { database.close(); await database.delete(); });
async function asset() { return createAsset({ name: '咖啡机', purchaseCost: '1000', purchaseDate: '2026-09-10', costMode: 'use', initialUsageCount: '2', expiryDate: null, note: null }, database, now); }

describe('cost and revenue CRUD', () => {
  it('creates all three allowed types and produces the fixed totals', async () => {
    const parent = await asset();
    const additional = await createRecord(parent.id, { type: 'additional', amount: '200', date: '2026-09-11', note: '维修' }, database, now);
    const consumable = await createRecord(parent.id, { type: 'consumable', amount: '300', date: '2026-09-12', note: '咖啡豆' }, database, now);
    const revenue = await createRecord(parent.id, { type: 'revenue', amount: '100', date: '2026-09-13', note: '' }, database, now);
    expect(additional.table).toBe('cost'); expect(consumable.table).toBe('cost'); expect(revenue.table).toBe('revenue');
    const totals = calculateAssetCosts(parent, await database.costRecords.toArray(), await database.revenueRecords.toArray(), '2026-09-13');
    expect(totals).toMatchObject({ totalCostCents: 150_000, revenueCents: 10_000, netCostCents: 140_000 });
  });

  it('updates a cost kind and revenue while retaining identity', async () => {
    const parent = await asset();
    const cost = await createRecord(parent.id, { type: 'additional', amount: '10', date: '2026-09-11', note: null }, database, now);
    const revenue = await createRecord(parent.id, { type: 'revenue', amount: '2000', date: '2026-09-12', note: null }, database, now);
    if (cost.table !== 'cost' || revenue.table !== 'revenue') throw new Error('unexpected fixture');
    const changedCost = await updateCostRecord(parent.id, cost.record, { type: 'consumable', amount: '20', date: '2026-09-12', note: '更换类型' }, database, new Date('2026-09-14T08:00:00.000Z'));
    const changedRevenue = await updateRevenueRecord(parent.id, revenue.record, { amount: '2100', date: '2026-09-13', note: '' }, database, new Date('2026-09-14T08:00:00.000Z'));
    expect(changedCost).toMatchObject({ id: cost.record.id, createdAt: cost.record.createdAt, kind: 'consumable', amountCents: 2000 });
    expect(changedRevenue).toMatchObject({ id: revenue.record.id, createdAt: revenue.record.createdAt, amountCents: 210_000, note: null });
  });

  it('rejects orphans, parent mismatches, and invalid dates or amounts', async () => {
    const parent = await asset(); const other = await createAsset({ name: '打印机', purchaseCost: '1000', purchaseDate: '2026-09-10', costMode: 'day', expiryDate: null, note: null }, database, now);
    await expect(createRecord(crypto.randomUUID(), { type: 'additional', amount: '1', date: '2026-09-13', note: null }, database, now)).rejects.toBeInstanceOf(RecordConflictError);
    await expect(createRecord(parent.id, { type: 'additional', amount: '1', date: '2026-09-09', note: null }, database, now)).rejects.toThrow('costRecord.date');
    await expect(createRecord(parent.id, { type: 'revenue', amount: '1', date: '2026-09-14', note: null }, database, now)).rejects.toThrow('revenueRecord.date');
    await expect(createRecord(parent.id, { type: 'consumable', amount: '0', date: '2026-09-13', note: null }, database, now)).rejects.toThrow();
    const record = await createRecord(parent.id, { type: 'additional', amount: '1', date: '2026-09-13', note: null }, database, now);
    if (record.table !== 'cost') throw new Error('unexpected fixture');
    expect(await getCostRecord(other.id, record.record.id, database)).toBeNull();
    expect(await getRevenueRecord(parent.id, record.record.id, database)).toBeNull();
  });

  it('rejects stale edits and stale deletes', async () => {
    const parent = await asset(); const result = await createRecord(parent.id, { type: 'revenue', amount: '10', date: '2026-09-13', note: null }, database, now);
    if (result.table !== 'revenue') throw new Error('unexpected fixture');
    await database.revenueRecords.update(result.record.id, { note: '另一标签修改' });
    await expect(updateRevenueRecord(parent.id, result.record, { amount: '11', date: '2026-09-13', note: null }, database, now)).rejects.toBeInstanceOf(RecordConflictError);
    await expect(deleteRecord(result, database)).rejects.toBeInstanceOf(RecordConflictError);
    expect(await database.revenueRecords.get(result.record.id)).toBeDefined();
  });

  it('deletes only the selected row and rolls back a failed delete', async () => {
    const parent = await asset(); const first = await createRecord(parent.id, { type: 'additional', amount: '10', date: '2026-09-13', note: null }, database, now); const second = await createRecord(parent.id, { type: 'consumable', amount: '20', date: '2026-09-13', note: null }, database, now);
    await deleteRecord(first, database); expect(await database.costRecords.count()).toBe(1);
    if (second.table !== 'cost') throw new Error('unexpected fixture');
    const fail = () => { throw new Error('forced failure'); }; database.costRecords.hook('deleting').subscribe(fail);
    await expect(deleteRecord(second, database)).rejects.toThrow('forced failure'); database.costRecords.hook('deleting').unsubscribe(fail);
    expect(await database.costRecords.get(second.record.id)).toBeDefined();
  });

  it('rejects a write if its parent was deleted concurrently', async () => {
    const parent = await asset(); const result = await createRecord(parent.id, { type: 'additional', amount: '10', date: '2026-09-13', note: null }, database, now);
    if (result.table !== 'cost') throw new Error('unexpected fixture');
    await database.assets.delete(parent.id);
    await expect(updateCostRecord(parent.id, result.record, { type: 'additional', amount: '11', date: '2026-09-13', note: null }, database, now)).rejects.toBeInstanceOf(RecordConflictError);
  });
});
