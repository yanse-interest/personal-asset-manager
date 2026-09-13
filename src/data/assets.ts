import { localToday } from '../domain/dates';
import { parseYuan } from '../domain/money';
import type { Asset, CostMode, LocalDate } from '../domain/types';
import { MAX_RECORDS, MAX_USAGE_COUNT, validateAsset } from '../domain/validation';
import { db, type AssetDatabase } from './db';

export interface AssetInput {
  name: string; purchaseCost: string; purchaseDate: LocalDate; costMode: CostMode;
  initialUsageCount?: string; expiryDate: LocalDate | null; note: string | null;
}
export type AssetPatch = Omit<AssetInput, 'initialUsageCount'>;
export interface AssetDeleteSnapshot { asset: Asset; costRecordIds: string[]; revenueRecordIds: string[] }

export class AssetConflictError extends Error {
  constructor(message = '资产已在其他页面修改，请重新载入后核对。') { super(message); this.name = 'AssetConflictError'; }
}
export class AssetLimitError extends Error {
  constructor() { super(`本地数据库最多保存 ${MAX_RECORDS} 条资产和流水。`); this.name = 'AssetLimitError'; }
}

const sameAsset = (a: Asset, b: Asset) => Object.keys(a).every(key => a[key as keyof Asset] === b[key as keyof Asset]);
function parseUsageCount(text = '0'): number {
  if (!/^(0|[1-9]\d*)$/.test(text)) throw new Error('使用次数必须是非负整数');
  const result = Number(text);
  if (!Number.isSafeInteger(result) || result > MAX_USAGE_COUNT) throw new Error('使用次数超出允许范围');
  return result;
}

function requireUsageAsset(current: Asset | undefined): Asset {
  if (!current) throw new AssetConflictError('资产不存在或已删除。');
  if (current.costMode !== 'use') throw new AssetConflictError('该资产已切换为按天观察，请刷新页面。');
  return current;
}
async function assertCapacity(database: AssetDatabase): Promise<void> {
  const count = await database.assets.count() + await database.costRecords.count() + await database.revenueRecords.count();
  if (count >= MAX_RECORDS) throw new AssetLimitError();
}

export const listAssets = (database: AssetDatabase = db) => database.assets.toArray();
export const getAsset = (id: string, database: AssetDatabase = db) => database.assets.get(id);

export async function createAsset(input: AssetInput, database: AssetDatabase = db, now = new Date()): Promise<Asset> {
  const timestamp = now.toISOString();
  const asset = validateAsset({
    id: crypto.randomUUID(), name: input.name, purchaseCostCents: parseYuan(input.purchaseCost, true),
    purchaseDate: input.purchaseDate, costMode: input.costMode,
    usageCount: input.costMode === 'use' ? parseUsageCount(input.initialUsageCount) : 0,
    expiryDate: input.expiryDate, note: input.note, createdAt: timestamp, updatedAt: timestamp,
  }, localToday(now));
  await database.transaction('rw', database.assets, database.costRecords, database.revenueRecords, async () => {
    await assertCapacity(database); await database.assets.add(asset);
  });
  return asset;
}

export async function updateAsset(id: string, expected: Asset, patch: AssetPatch, database: AssetDatabase = db, now = new Date()): Promise<Asset> {
  return database.transaction('rw', database.assets, database.costRecords, database.revenueRecords, async () => {
    const current = await database.assets.get(id);
    if (!current) throw new AssetConflictError('资产不存在或已删除。');
    if (!sameAsset(current, expected)) throw new AssetConflictError();
    const [costDates, revenueDates] = await Promise.all([
      database.costRecords.where('assetId').equals(id).sortBy('date'),
      database.revenueRecords.where('assetId').equals(id).sortBy('date'),
    ]);
    const earliest = [...costDates, ...revenueDates].map(record => record.date).sort()[0];
    if (earliest && patch.purchaseDate > earliest) throw new Error(`购买日期不得晚于已有流水日期 ${earliest}`);
    const updated = validateAsset({ ...current, name: patch.name, purchaseCostCents: parseYuan(patch.purchaseCost, true),
      purchaseDate: patch.purchaseDate, costMode: patch.costMode, expiryDate: patch.expiryDate,
      note: patch.note, updatedAt: now.toISOString() }, localToday(now));
    await database.assets.put(updated); return updated;
  });
}

export async function incrementUsage(id: string, database: AssetDatabase = db, now = new Date()): Promise<Asset> {
  return database.transaction('rw', database.assets, async () => {
    const current = requireUsageAsset(await database.assets.get(id));
    if (current.usageCount >= MAX_USAGE_COUNT) throw new Error('使用次数已达到上限。');
    const updated = { ...current, usageCount: current.usageCount + 1, updatedAt: now.toISOString() };
    await database.assets.put(updated);
    return updated;
  });
}

export async function correctUsageCount(
  id: string,
  expectedUsageCount: number,
  nextUsageCount: string,
  database: AssetDatabase = db,
  now = new Date(),
): Promise<Asset> {
  const parsed = parseUsageCount(nextUsageCount);
  return database.transaction('rw', database.assets, async () => {
    const current = requireUsageAsset(await database.assets.get(id));
    if (current.usageCount !== expectedUsageCount) {
      throw new AssetConflictError('使用次数已在其他页面变化，请核对最新次数后重试。');
    }
    const updated = { ...current, usageCount: parsed, updatedAt: now.toISOString() };
    await database.assets.put(updated);
    return updated;
  });
}

async function snapshotInside(id: string, database: AssetDatabase): Promise<AssetDeleteSnapshot | null> {
  const asset = await database.assets.get(id); if (!asset) return null;
  const [costRecordIds, revenueRecordIds] = await Promise.all([
    database.costRecords.where('assetId').equals(id).primaryKeys(),
    database.revenueRecords.where('assetId').equals(id).primaryKeys(),
  ]);
  return { asset, costRecordIds: costRecordIds.sort(), revenueRecordIds: revenueRecordIds.sort() };
}
export function getAssetDeleteSnapshot(id: string, database: AssetDatabase = db): Promise<AssetDeleteSnapshot | null> {
  return database.transaction('r', database.assets, database.costRecords, database.revenueRecords, () => snapshotInside(id, database));
}
function sameSnapshot(a: AssetDeleteSnapshot, b: AssetDeleteSnapshot): boolean {
  return sameAsset(a.asset, b.asset) && a.costRecordIds.join('\0') === b.costRecordIds.join('\0') && a.revenueRecordIds.join('\0') === b.revenueRecordIds.join('\0');
}
export async function deleteAsset(snapshot: AssetDeleteSnapshot, database: AssetDatabase = db): Promise<void> {
  await database.transaction('rw', database.assets, database.costRecords, database.revenueRecords, async () => {
    const current = await snapshotInside(snapshot.asset.id, database);
    if (!current || !sameSnapshot(current, snapshot)) throw new AssetConflictError('资产或关联流水已变化，请核对最新删除信息后再次确认。');
    await database.costRecords.where('assetId').equals(snapshot.asset.id).delete();
    await database.revenueRecords.where('assetId').equals(snapshot.asset.id).delete();
    await database.assets.delete(snapshot.asset.id);
  });
}
