import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { AssetDatabase } from './db';
import type { Asset } from '../domain/types';

const timestamp = '2026-09-13T00:00:00.000Z';
const asset: Asset = {
  id: '123e4567-e89b-42d3-a456-426614174000', name: '测试资产',
  purchaseCostCents: 100_000, purchaseDate: '2026-09-13', costMode: 'day',
  usageCount: 0, expiryDate: null, note: null, createdAt: timestamp, updatedAt: timestamp,
};

describe('Dexie v1 schema', () => {
  it('persists all three stores and their parent indexes across reopen', async () => {
    const name = `asset-test-${crypto.randomUUID()}`;
    const first = new AssetDatabase(name);
    try {
      await first.open();
      expect(first.verno).toBe(1);
      expect(first.tables.map(table => table.name).sort()).toEqual(['assets', 'costRecords', 'revenueRecords']);
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
});
