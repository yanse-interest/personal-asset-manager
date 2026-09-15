import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { AssetDatabase, type DatabaseIssue } from './db';
import type { Asset, LegacyAssetV1 } from '../domain/types';
import { Dexie } from 'dexie';

const timestamp = '2026-09-13T00:00:00.000Z';
const asset: Asset = {
  id: '123e4567-e89b-42d3-a456-426614174000', name: '测试资产',
  purchaseCostCents: 100_000, purchaseDate: '2026-09-13', costMode: 'day',
  usageCount: 0, expiryDate: null, note: null, createdAt: timestamp, updatedAt: timestamp,
  categoryId: null, lifecycleStatus: 'active', endedDate: null, iconId: null,
};

describe('Dexie v3 schema', () => {
  it('persists four stores and their parent indexes across reopen', async () => {
    const name = `asset-test-${crypto.randomUUID()}`;
    const first = new AssetDatabase(name);
    try {
      await first.open();
      expect(first.verno).toBe(3);
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
      expect(await upgraded.assets.get(asset.id)).toEqual({ ...oldAsset, categoryId: null, lifecycleStatus: 'active', endedDate: null, iconId: null });
      expect(await upgraded.costRecords.toArray()).toEqual([oldCost]);
      expect(await upgraded.categories.count()).toBe(0);
      upgraded.close();
      const repeated = new AssetDatabase(name);
      try { expect(await repeated.assets.toArray()).toEqual([{ ...oldAsset, categoryId: null, lifecycleStatus: 'active', endedDate: null, iconId: null }]); }
      finally { repeated.close(); }
    } finally { upgraded.close(); await upgraded.delete(); }
  });

  it('adds an automatic icon to existing v2 assets without changing their facts or records', async () => {
    const name = `v2-icon-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(2).stores({ assets: 'id', categories: 'id, &name', costRecords: 'id, assetId', revenueRecords: 'id, assetId' });
    const oldAsset = { ...asset }; delete (oldAsset as Partial<Asset>).iconId;
    const oldCost = { id: crypto.randomUUID(), assetId: asset.id, kind: 'additional', amountCents: 100, date: asset.purchaseDate, note: null, createdAt: timestamp, updatedAt: timestamp };
    await legacy.open();
    await legacy.table('assets').add(oldAsset);
    await legacy.table('costRecords').add(oldCost);
    legacy.close();
    const upgraded = new AssetDatabase(name);
    try {
      expect(await upgraded.assets.get(asset.id)).toEqual({ ...oldAsset, iconId: null });
      expect(await upgraded.costRecords.toArray()).toEqual([oldCost]);
      expect(await upgraded.categories.count()).toBe(0);
    } finally { upgraded.close(); await upgraded.delete(); }
  });

  it('reports a blocked upgrade and preserves existing data once the old connection closes', async () => {
    const name = `blocked-upgrade-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(2).stores({ assets: 'id', categories: 'id, &name', costRecords: 'id, assetId', revenueRecords: 'id, assetId' });
    const oldAsset = { ...asset }; delete (oldAsset as Partial<Asset>).iconId;
    const oldCost = { id: crypto.randomUUID(), assetId: asset.id, kind: 'additional', amountCents: 100, date: asset.purchaseDate, note: null, createdAt: timestamp, updatedAt: timestamp };
    let heldConnection: IDBDatabase | undefined;
    const events: string[] = [];
    const upgraded = new AssetDatabase(name, issue => {
      events.push(issue);
      if (issue === 'blocked') heldConnection?.close();
    });
    try {
      await legacy.open();
      await legacy.table('assets').add(oldAsset);
      await legacy.table('costRecords').add(oldCost);
      legacy.close();
      // A native connection models an old tab that ignores versionchange.
      heldConnection = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      heldConnection.onversionchange = () => { events.push('old-versionchange'); };
      await upgraded.open();
      expect(events).toEqual(['old-versionchange', 'blocked']);
      expect(upgraded.isOpen()).toBe(true);
      expect(upgraded.verno).toBe(3);
      expect(await upgraded.assets.toArray()).toEqual([{ ...oldAsset, iconId: null }]);
      expect(await upgraded.costRecords.toArray()).toEqual([oldCost]);
    } finally {
      heldConnection?.close(); legacy.close(); upgraded.close(); await upgraded.delete();
    }
  });

  it('closes an old AssetDatabase on versionchange and reports the issue before the upgrade completes', async () => {
    const name = `versionchange-${crypto.randomUUID()}`;
    const events: Array<{ issue: DatabaseIssue; open: boolean }> = [];
    const current = new AssetDatabase(name, issue => { events.push({ issue, open: current.isOpen() }); });
    const upgraded = new Dexie(name);
    upgraded.version(4).stores({ assets: 'id', categories: 'id, &name', costRecords: 'id, assetId', revenueRecords: 'id, assetId' });
    const blocked: string[] = [];
    upgraded.on('blocked', () => { blocked.push('blocked'); });
    try {
      await current.open();
      await current.assets.add(asset);
      await upgraded.open();
      expect(events).toEqual([{ issue: 'versionchange', open: false }]);
      expect(current.isOpen()).toBe(false);
      expect(blocked).toEqual([]);
      expect(await upgraded.table('assets').toArray()).toEqual([asset]);
    } finally { current.close(); upgraded.close(); await upgraded.delete(); }
  });
});
