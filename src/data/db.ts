import { Dexie, type EntityTable } from 'dexie';
import type { Asset, Category, CostRecord, LegacyAssetV1, RegularItem, RegularPurchase, RegularVariant, RevenueRecord } from '../domain/types';

export type DatabaseIssue = 'blocked' | 'versionchange';

export class AssetDatabase extends Dexie {
  assets!: EntityTable<Asset, 'id'>;
  costRecords!: EntityTable<CostRecord, 'id'>;
  revenueRecords!: EntityTable<RevenueRecord, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  regularItems!: EntityTable<RegularItem, 'id'>;
  regularVariants!: EntityTable<RegularVariant, 'id'>;
  regularPurchases!: EntityTable<RegularPurchase, 'id'>;

  constructor(name = 'large-asset-cost', onIssue?: (issue: DatabaseIssue) => void) {
    super(name);
    this.version(1).stores({
      assets: 'id',
      costRecords: 'id, assetId',
      revenueRecords: 'id, assetId',
    });
    this.version(2).stores({
      assets: 'id',
      categories: 'id, &name',
      costRecords: 'id, assetId',
      revenueRecords: 'id, assetId',
    }).upgrade(async transaction => {
      await transaction.table<LegacyAssetV1, string>('assets').toCollection().modify(asset => {
        Object.assign(asset, { categoryId: null, lifecycleStatus: 'active', endedDate: null });
      });
    });
    this.version(3).stores({
      assets: 'id',
      categories: 'id, &name',
      costRecords: 'id, assetId',
      revenueRecords: 'id, assetId',
    }).upgrade(async transaction => {
      await transaction.table<Asset, string>('assets').toCollection().modify(asset => { asset.iconId = null; });
    });
    this.version(4).stores({
      assets: 'id',
      categories: 'id, &name',
      costRecords: 'id, assetId',
      revenueRecords: 'id, assetId',
    }).upgrade(async transaction => {
      await transaction.table<Asset, string>('assets').toCollection().modify(asset => { asset.serviceStartDate = asset.purchaseDate; });
    });
    this.version(5).stores({
      assets: 'id', categories: 'id, &name', costRecords: 'id, assetId', revenueRecords: 'id, assetId',
      regularItems: 'id', regularVariants: 'id, itemId', regularPurchases: 'id, variantId',
    });
    this.on('blocked', () => onIssue?.('blocked'));
    this.on('versionchange', () => {
      this.close();
      onIssue?.('versionchange');
    });
  }
}

const issueListeners = new Set<(issue: DatabaseIssue) => void>();
export const db = new AssetDatabase('large-asset-cost', issue => {
  for (const listener of issueListeners) listener(issue);
});

export function subscribeDatabaseIssues(listener: (issue: DatabaseIssue) => void): () => void {
  issueListeners.add(listener);
  return () => { issueListeners.delete(listener); };
}
