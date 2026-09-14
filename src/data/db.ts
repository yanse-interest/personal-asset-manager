import { Dexie, type EntityTable } from 'dexie';
import type { Asset, Category, CostRecord, LegacyAssetV1, RevenueRecord } from '../domain/types';

export type DatabaseIssue = 'blocked' | 'versionchange';

export class AssetDatabase extends Dexie {
  assets!: EntityTable<Asset, 'id'>;
  costRecords!: EntityTable<CostRecord, 'id'>;
  revenueRecords!: EntityTable<RevenueRecord, 'id'>;
  categories!: EntityTable<Category, 'id'>;

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
