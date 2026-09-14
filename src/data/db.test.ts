import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { AssetDatabase } from './db';
import type { Asset, LegacyAssetV1 } from '../domain/types';
import { Dexie } from 'dexie';

const timestamp = '2026-09-13T00:00:00.000Z';
const asset: Asset = {
  id: '123e4567-e89b-42d3-a456-426614174000', name: '测试资产',
  purchaseCostCents: 100_000, purchaseDate: '2026-09-13', costMode: 'day',
  usageCount: 0, expiryDate: null, note: null, createdAt: timestamp, updatedAt: timestamp,
  categoryId: null, lifecycleStatus: 'active', endedDate: null,
};

describe('Dexie v2 schema', () => {
  it('persists four stores and their parent indexes across reopen', async () => {
    const name = `asset-test-${crypto.randomUUID()}`;
    const first = new AssetDatabase(name);
    try {
      await first.open();
      expect(first.verno).toBe(2);
      expect(first.tables.map(table => table.name).sort()).toEqual(['assets', 'categories', 'costRecords', 'revenueRecords']);
      await first.assets.add(asset);
      await first.costRecords.add({ id: '123e4567-e89b-42d3-a456-426614174001', assetId: asset.id, kind: 'additional', amountCents: 100, date: '2026-09-13', note: null, createdAt: timestamp, updatedAt: timestamp });
      await first.revenueRecords.add({ id: '123e4567-e89b-42d3-a456-426614174002', assetId: asset.id, amountCents: 50, date: '2026-09-13', note: null, createdAt: timestamp, updatedAt: timestamp });
      first.close();
      const reopened = new AssetDatabase(name);
      try {
        expect(await reopened.assets.get(asset.id)).toEqual(asset);
        expect(await reopened.costRecords.where('assetId').equals(asset.id).count()).toBe(1);
        expect(await reopened.revenueRecords.where('assetId').equals(asset.id).count()).toBe(1);
      } finally { reopened.close(); }
    } finally { first.close(); await first.delete(); }
  });

  it('atomically migrates a real v1 shape once without touching original fields or records', async () => {
    const name = `legacy-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(1).stores({ assets: 'id', costRecords: 'id, assetId', revenueRecords: 'id, assetId' });
    const oldAsset: LegacyAssetV1 = { id: asset.id, name: asset.name, purchaseCostCents: asset.purchaseCostCents, purchaseDate: asset.purchaseDate, costMode: asset.costMode, usageCount: asset.usageCount, expiryDate: asset.expiryDate, note: asset.note, createdAt: asset.createdAt, updatedAt: asset.updatedAt };
    const oldCost = { id: crypto.randomUUID(), assetId: asset.id, kind: 'additional', amountCents: 100, date: asset.purchaseDate, note: null, createdAt: timestamp, updatedAt: timestamp };
    await legacy.open(); await legacy.table('assets').add(oldAsset); await legacy.table('costRecords').add(oldCost); legacy.close();
    const upgraded = new AssetDatabase(name);
    try {
      expect(await upgraded.assets.get(asset.id)).toEqual({ ...oldAsset, categoryId: null, lifecycleStatus: 'active', endedDate: null });
      expect(await upgraded.costRecords.toArray()).toEqual([oldCost]);
      expect(await upgraded.categories.count()).toBe(0);
      upgraded.close();
      const repeated = new AssetDatabase(name);
      try { expect(await repeated.assets.toArray()).toEqual([{ ...oldAsset, categoryId: null, lifecycleStatus: 'active', endedDate: null }]); }
      finally { repeated.close(); }
    } finally { upgraded.close(); await upgraded.delete(); }
  });
});
