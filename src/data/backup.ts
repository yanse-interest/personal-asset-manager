import { localToday } from '../domain/dates';
import type { Asset, BackupV1, CostRecord, RevenueRecord } from '../domain/types';
import { MAX_RECORDS, validateAsset, validateCostRecord, validateInstant, validateRevenueRecord } from '../domain/validation';
import { db, type AssetDatabase } from './db';

export const MAX_BACKUP_BYTES = 80 * 1024 * 1024;
const FORMAT = 'large-asset-cost-backup';
const ROOT_FIELDS = ['format', 'schemaVersion', 'exportedAt', 'currency', 'assets', 'costRecords', 'revenueRecords'] as const;
type BackupCounts = { assets: number; costRecords: number; revenueRecords: number };

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${path}: 必须是普通对象`);
  }
  return value as Record<string, unknown>;
}
function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path}: 必须是数组`);
  return value;
}
function exactFields(value: Record<string, unknown>, fields: readonly string[], path: string): void {
  for (const field of fields) if (!Object.hasOwn(value, field)) throw new Error(`${path}.${field}: 缺少字段`);
  for (const field of Object.keys(value)) if (!fields.includes(field)) throw new Error(`${path}.${field}: 未知字段`);
}
function atPath<T>(path: string, entity: string, fn: () => T): T {
  try { return fn(); }
  catch (reason) {
    if (!(reason instanceof Error)) throw reason;
    throw new Error(reason.message.replace(new RegExp(`^${entity}(?=\\.|:)`), path));
  }
}
function uniqueId(id: string, seen: Set<string>, path: string): void {
  if (seen.has(id)) throw new Error(`${path}.id: 重复 ID`);
  seen.add(id);
}
function safeAdd(sum: number, value: number, path: string): number {
  const result = sum + value;
  if (!Number.isSafeInteger(result)) throw new Error(`${path}: 金额合计超出安全整数范围`);
  return result;
}

export function validateBackupV1(value: unknown, now = new Date()): BackupV1 {
  const today = localToday(now);
  const root = object(value, 'backup');
  exactFields(root, ROOT_FIELDS, 'backup');
  if (root.format !== FORMAT) throw new Error('backup.format: 未知备份格式');
  if (root.schemaVersion !== 1) throw new Error('backup.schemaVersion: 不支持的备份版本');
  if (root.currency !== 'CNY') throw new Error('backup.currency: 仅支持 CNY');
  const exportedAt = validateInstant(root.exportedAt, 'backup.exportedAt');
  const rawAssets = array(root.assets, 'backup.assets');
  const rawCosts = array(root.costRecords, 'backup.costRecords');
  const rawRevenues = array(root.revenueRecords, 'backup.revenueRecords');
  if (rawAssets.length + rawCosts.length + rawRevenues.length > MAX_RECORDS) {
    throw new Error(`backup: 资产与流水总条数不得超过 ${MAX_RECORDS}`);
  }
  const seenAssets = new Set<string>();
  const assets: Asset[] = rawAssets.map((raw, index) => {
    const path = `backup.assets[${index}]`;
    const asset = atPath(path, 'asset', () => validateAsset(raw, today));
    uniqueId(asset.id, seenAssets, path);
    return asset;
  });
  const assetsById = new Map(assets.map(asset => [asset.id, asset]));
  const seenCosts = new Set<string>();
  const costRecords: CostRecord[] = rawCosts.map((raw, index) => {
    const path = `backup.costRecords[${index}]`;
    const input = object(raw, path);
    const parent = assetsById.get(input.assetId as string);
    if (!parent) throw new Error(`${path}.assetId: 引用的资产不存在`);
    const record = atPath(path, 'costRecord', () => validateCostRecord(raw, today, parent.purchaseDate));
    uniqueId(record.id, seenCosts, path);
    return record;
  });
  const seenRevenues = new Set<string>();
  const revenueRecords: RevenueRecord[] = rawRevenues.map((raw, index) => {
    const path = `backup.revenueRecords[${index}]`;
    const input = object(raw, path);
    const parent = assetsById.get(input.assetId as string);
    if (!parent) throw new Error(`${path}.assetId: 引用的资产不存在`);
    const record = atPath(path, 'revenueRecord', () => validateRevenueRecord(raw, today, parent.purchaseDate));
    uniqueId(record.id, seenRevenues, path);
    return record;
  });
  let totalCost = 0; let totalRevenue = 0;
  for (const asset of assets) totalCost = safeAdd(totalCost, asset.purchaseCostCents, 'backup.totalCost');
  for (const record of costRecords) totalCost = safeAdd(totalCost, record.amountCents, 'backup.totalCost');
  for (const record of revenueRecords) totalRevenue = safeAdd(totalRevenue, record.amountCents, 'backup.totalRevenue');
  safeAdd(totalCost, -totalRevenue, 'backup.netCost');
  return { format: FORMAT, schemaVersion: 1, exportedAt, currency: 'CNY', assets, costRecords, revenueRecords };
}

export function parseBackupJson(json: string, now = new Date()): BackupV1 {
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) throw new Error('backup: 文件超过 80 MiB');
  let parsed: unknown;
  try { parsed = JSON.parse(json) as unknown; }
  catch { throw new Error('backup: JSON 格式无效或文件为空'); }
  return validateBackupV1(parsed, now);
}

export async function readBackupFile(file: File, now = new Date()): Promise<BackupV1> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('backup: 文件超过 80 MiB');
  let json: string;
  try { json = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
  catch { throw new Error('backup: 文件读取失败或不是有效 UTF-8'); }
  return parseBackupJson(json, now);
}

export async function getBackupCounts(database: AssetDatabase = db): Promise<BackupCounts> {
  return database.transaction('r', database.assets, database.costRecords, database.revenueRecords, async () => ({
    assets: await database.assets.count(),
    costRecords: await database.costRecords.count(),
    revenueRecords: await database.revenueRecords.count(),
  }));
}

export async function exportBackup(database: AssetDatabase = db, now = new Date()): Promise<{ json: string; filename: string }> {
  const snapshot = await database.transaction('r', database.assets, database.costRecords, database.revenueRecords, async () => ({
    assets: await database.assets.toArray(),
    costRecords: await database.costRecords.toArray(),
    revenueRecords: await database.revenueRecords.toArray(),
  }));
  const byId = <T extends { id: string }>(items: T[]) => items.sort((left, right) => left.id.localeCompare(right.id));
  const backup: BackupV1 = {
    format: FORMAT, schemaVersion: 1, exportedAt: now.toISOString(), currency: 'CNY',
    assets: byId(snapshot.assets), costRecords: byId(snapshot.costRecords), revenueRecords: byId(snapshot.revenueRecords),
  };
  const json = JSON.stringify(backup);
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) throw new Error('backup: 导出文件超过 80 MiB');
  const datePart = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('');
  const timePart = [now.getHours(), now.getMinutes(), now.getSeconds()].map(value => String(value).padStart(2, '0')).join('');
  return { json, filename: `asset-cost-backup-${datePart}-${timePart}.json` };
}

export async function replaceFromBackup(candidate: unknown, database: AssetDatabase = db, now = new Date()): Promise<void> {
  const backup = validateBackupV1(candidate, now);
  await database.transaction('rw', database.assets, database.costRecords, database.revenueRecords, async () => {
    await database.assets.clear();
    await database.costRecords.clear();
    await database.revenueRecords.clear();
    await database.assets.bulkAdd(backup.assets);
    await database.costRecords.bulkAdd(backup.costRecords);
    await database.revenueRecords.bulkAdd(backup.revenueRecords);
  });
}
