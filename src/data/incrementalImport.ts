import { localToday } from '../domain/dates';
import type { Asset, CostRecord, RevenueRecord } from '../domain/types';
import { MAX_CATEGORIES, MAX_RECORDS, validateCategory } from '../domain/validation';
import { MAX_BACKUP_BYTES, validateBackupV3 } from './backup';
import { db, type AssetDatabase } from './db';

export interface IncrementalImport {
  format: 'large-asset-cost-increment';
  schemaVersion: 1;
  exportedAt: string;
  currency: 'CNY';
  categoryName: string;
  assets: Asset[];
  costRecords: CostRecord[];
  revenueRecords: RevenueRecord[];
}

export function parseIncrementalImport(json: string, now = new Date()): IncrementalImport {
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) throw new Error('增量文件超过 80 MiB');
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { throw new Error('增量文件 JSON 格式无效'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('增量文件必须是对象');
  const root = raw as Record<string, unknown>;
  const fields = ['format', 'schemaVersion', 'exportedAt', 'currency', 'categoryName', 'assets', 'costRecords', 'revenueRecords'];
  if (Object.keys(root).length !== fields.length || fields.some(field => !Object.hasOwn(root, field))) throw new Error('增量文件字段不完整或含未知字段');
  if (root.format !== 'large-asset-cost-increment' || root.schemaVersion !== 1) throw new Error('不支持的增量文件格式或版本');
  const categoryName = validateCategory({ id: '11111111-1111-4111-8111-111111111111', name: root.categoryName, createdAt: root.exportedAt, updatedAt: root.exportedAt }).name;
  const backup = validateBackupV3({
    format: 'large-asset-cost-backup', schemaVersion: 3, exportedAt: root.exportedAt,
    currency: root.currency, assets: root.assets, categories: [], costRecords: root.costRecords, revenueRecords: root.revenueRecords,
  }, now);
  if (backup.assets.length === 0) throw new Error('增量文件必须包含好物');
  if (backup.assets.some(asset => asset.categoryId !== null)) throw new Error('增量好物须由目标库按类别名称归类');
  return { format: 'large-asset-cost-increment', schemaVersion: 1, exportedAt: backup.exportedAt,
    currency: 'CNY', categoryName, assets: backup.assets, costRecords: backup.costRecords, revenueRecords: backup.revenueRecords };
}

export async function readIncrementalFile(file: File, now = new Date()): Promise<IncrementalImport> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('增量文件超过 80 MiB');
  let json: string;
  try { json = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
  catch { throw new Error('无法读取增量文件或 UTF-8 无效'); }
  return parseIncrementalImport(json, now);
}

const identity = (asset: Asset) => `${asset.name}\u0000${asset.purchaseDate}\u0000${asset.purchaseCostCents}`;

export async function mergeIncrementalImport(input: IncrementalImport, database: AssetDatabase = db, now = new Date()): Promise<void> {
  const candidate = parseIncrementalImport(JSON.stringify(input), now);
  await database.transaction('rw', database.assets, database.categories, database.costRecords, database.revenueRecords, async () => {
    const [assets, categories, costs, revenues] = await Promise.all([
      database.assets.toArray(), database.categories.toArray(), database.costRecords.toArray(), database.revenueRecords.toArray(),
    ]);
    if (assets.length + costs.length + revenues.length + candidate.assets.length + candidate.costRecords.length + candidate.revenueRecords.length > MAX_RECORDS) throw new Error(`合并后资产与流水不得超过 ${MAX_RECORDS} 条`);
    const assetIds = new Set(assets.map(asset => asset.id));
    const costIds = new Set(costs.map(record => record.id));
    const revenueIds = new Set(revenues.map(record => record.id));
    const identities = new Set(assets.map(identity));
    for (const asset of candidate.assets) {
      if (assetIds.has(asset.id) || identities.has(identity(asset))) throw new Error(`好物已存在或疑似重复：${asset.name}（${asset.purchaseDate}）`);
      identities.add(identity(asset));
    }
    if (candidate.costRecords.some(record => costIds.has(record.id)) || candidate.revenueRecords.some(record => revenueIds.has(record.id))) throw new Error('流水 ID 与现有数据重复');
    let category = categories.find(item => item.name === candidate.categoryName);
    if (!category) {
      if (categories.length >= MAX_CATEGORIES) throw new Error(`类别不得超过 ${MAX_CATEGORIES} 条`);
      const timestamp = now.toISOString();
      category = validateCategory({ id: crypto.randomUUID(), name: candidate.categoryName, createdAt: timestamp, updatedAt: timestamp });
      await database.categories.add(category);
    }
    await database.assets.bulkAdd(candidate.assets.map(asset => ({ ...asset, categoryId: category!.id })));
    await database.costRecords.bulkAdd(candidate.costRecords);
    await database.revenueRecords.bulkAdd(candidate.revenueRecords);
  });
}
