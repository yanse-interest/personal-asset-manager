import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssetDatabase } from './db';
import { createAsset } from './assets';
import { createRecord } from './records';
import { getAssetDetailSnapshot, getDashboardSnapshot } from './queries';
import { calculateAssetCosts } from '../domain/calculations';

const now = new Date('2026-09-13T08:00:00.000Z');
let database: AssetDatabase;
beforeEach(() => { database = new AssetDatabase(`queries-${crypto.randomUUID()}`); });
afterEach(async () => { database.close(); await database.delete(); });

describe('read snapshots', () => {
  it('reads all dashboard facts in one snapshot and groups by asset id', async () => {
    const day = await createAsset({ name: '按天资产', purchaseCost: '1000', purchaseDate: '2026-09-13', costMode: 'day', expiryDate: '2026-09-15', note: null }, database, now);
    const use = await createAsset({ name: '按次资产', purchaseCost: '100', purchaseDate: '2026-09-12', costMode: 'use', initialUsageCount: '2', expiryDate: null, note: null }, database, now);
    await createRecord(day.id, { type: 'additional', amount: '200', date: '2026-09-13', note: null }, database, now);
    await createRecord(day.id, { type: 'revenue', amount: '100', date: '2026-09-13', note: null }, database, now);
    await createRecord(use.id, { type: 'consumable', amount: '20', date: '2026-09-13', note: null }, database, now);
    const snapshot = await getDashboardSnapshot(database);
    expect(snapshot).toMatchObject({ assets: expect.arrayContaining([day, use]) });
    expect(calculateAssetCosts(day, snapshot.costs, snapshot.revenues, '2026-09-13')).toMatchObject({ totalCostCents: 120_000, revenueCents: 10_000, netCostCents: 110_000, daysOwned: 1 });
    expect(calculateAssetCosts(use, snapshot.costs, snapshot.revenues, '2026-09-13')).toMatchObject({ totalCostCents: 12_000, netCostCents: 12_000, daysOwned: 2, costPerUse: { denominator: 2 } });
  });

  it('returns only a selected asset’s records and null for a missing id', async () => {
    const first = await createAsset({ name: '第一件', purchaseCost: '1', purchaseDate: '2026-09-13', costMode: 'day', expiryDate: null, note: null }, database, now);
    const second = await createAsset({ name: '第二件', purchaseCost: '1', purchaseDate: '2026-09-13', costMode: 'day', expiryDate: null, note: null }, database, now);
    await createRecord(first.id, { type: 'additional', amount: '1', date: '2026-09-13', note: null }, database, now);
    await createRecord(second.id, { type: 'revenue', amount: '1', date: '2026-09-13', note: null }, database, now);
    const detail = await getAssetDetailSnapshot(first.id, database);
    expect(detail?.asset.id).toBe(first.id); expect(detail?.costs).toHaveLength(1); expect(detail?.revenues).toHaveLength(0);
    expect(await getAssetDetailSnapshot(crypto.randomUUID(), database)).toBeNull();
  });
});
