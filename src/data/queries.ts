import type { Asset, CostRecord, RevenueRecord } from '../domain/types';
import { db, type AssetDatabase } from './db';

export interface DashboardSnapshot { assets: Asset[]; costs: CostRecord[]; revenues: RevenueRecord[] }
export interface AssetDetailSnapshot { asset: Asset; costs: CostRecord[]; revenues: RevenueRecord[] }

export function getDashboardSnapshot(database: AssetDatabase = db): Promise<DashboardSnapshot> {
  return database.transaction('r', database.assets, database.costRecords, database.revenueRecords, async () => ({
    assets: await database.assets.toArray(),
    costs: await database.costRecords.toArray(),
    revenues: await database.revenueRecords.toArray(),
  }));
}

export function getAssetDetailSnapshot(assetId: string, database: AssetDatabase = db): Promise<AssetDetailSnapshot | null> {
  return database.transaction('r', database.assets, database.costRecords, database.revenueRecords, async () => {
    const asset = await database.assets.get(assetId);
    if (!asset) return null;
    const [costs, revenues] = await Promise.all([
      database.costRecords.where('assetId').equals(assetId).toArray(),
      database.revenueRecords.where('assetId').equals(assetId).toArray(),
    ]);
    return { asset, costs, revenues };
  });
}
