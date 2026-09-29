import { localToday } from '../domain/dates';
import type { Asset, AssetV2, AssetV3, AssetV4, BackupImport, BackupV1, BackupV2, BackupV3, BackupV4, BackupV5, BackupV6, Category, CostRecord, LegacyAssetV1, RevenueRecord } from '../domain/types';
import { MAX_CATEGORIES, MAX_RECORDS, validateAsset, validateAssetV2, validateAssetV3, validateAssetV4, validateCategory, validateCostRecord, validateInstant, validateLegacyAssetV1, validateRevenueRecord } from '../domain/validation';
import { MAX_REGULAR_ITEMS, MAX_REGULAR_PURCHASES, MAX_REGULAR_VARIANTS, validateRegularItem, validateRegularPurchase, validateRegularVariant } from '../domain/regularItems';
import { db, type AssetDatabase } from './db';

export const MAX_BACKUP_BYTES = 80 * 1024 * 1024;
const FORMAT = 'large-asset-cost-backup';
const V1_ROOT_FIELDS = ['format', 'schemaVersion', 'exportedAt', 'currency', 'assets', 'costRecords', 'revenueRecords'] as const;
const V2_ROOT_FIELDS = [...V1_ROOT_FIELDS, 'categories'] as const;
const V6_ROOT_FIELDS = [...V2_ROOT_FIELDS, 'regularItems', 'regularVariants', 'regularPurchases'] as const;
export type BackupCounts = { assets: number; categories: number; costRecords: number; revenueRecords: number; regularItems: number; regularVariants: number; regularPurchases: number };

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error(`${path}: 必须是普通对象`);
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
  try { return fn(); } catch (reason) {
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
function validateEnvelope(root: Record<string, unknown>, version: 1 | 2 | 3 | 4 | 5 | 6): string {
  exactFields(root, version === 1 ? V1_ROOT_FIELDS : version === 6 ? V6_ROOT_FIELDS : V2_ROOT_FIELDS, 'backup');
  if (root.format !== FORMAT) throw new Error('backup.format: 未知备份格式');
  if (root.schemaVersion !== version) throw new Error('backup.schemaVersion: 不支持的备份版本');
  if (root.currency !== 'CNY') throw new Error('backup.currency: 仅支持 CNY');
  return validateInstant(root.exportedAt, 'backup.exportedAt');
}
function validateRecords(rawCosts: unknown[], rawRevenues: unknown[], assets: readonly LegacyAssetV1[], today: string) {
  if (assets.length + rawCosts.length + rawRevenues.length > MAX_RECORDS) throw new Error(`backup: 资产与流水总条数不得超过 ${MAX_RECORDS}`);
  const assetsById = new Map(assets.map(asset => [asset.id, asset]));
  const seenCosts = new Set<string>();
  const costRecords: CostRecord[] = rawCosts.map((raw, index) => {
    const path = `backup.costRecords[${index}]`; const input = object(raw, path); const parent = assetsById.get(input.assetId as string);
    if (!parent) throw new Error(`${path}.assetId: 引用的资产不存在`);
    const record = atPath(path, 'costRecord', () => validateCostRecord(raw, today, parent.purchaseDate)); uniqueId(record.id, seenCosts, path); return record;
  });
  const seenRevenues = new Set<string>();
  const revenueRecords: RevenueRecord[] = rawRevenues.map((raw, index) => {
    const path = `backup.revenueRecords[${index}]`; const input = object(raw, path); const parent = assetsById.get(input.assetId as string);
    if (!parent) throw new Error(`${path}.assetId: 引用的资产不存在`);
    const record = atPath(path, 'revenueRecord', () => validateRevenueRecord(raw, today, parent.purchaseDate)); uniqueId(record.id, seenRevenues, path); return record;
  });
  let totalCost = 0; let totalRevenue = 0;
  for (const asset of assets) totalCost = safeAdd(totalCost, asset.purchaseCostCents, 'backup.totalCost');
  for (const record of costRecords) totalCost = safeAdd(totalCost, record.amountCents, 'backup.totalCost');
  for (const record of revenueRecords) totalRevenue = safeAdd(totalRevenue, record.amountCents, 'backup.totalRevenue');
  safeAdd(totalCost, -totalRevenue, 'backup.netCost');
  return { costRecords, revenueRecords };
}

export function validateBackupV1(value: unknown, now = new Date()): BackupV1 {
  const today = localToday(now); const root = object(value, 'backup'); const exportedAt = validateEnvelope(root, 1);
  const rawAssets = array(root.assets, 'backup.assets'); const rawCosts = array(root.costRecords, 'backup.costRecords'); const rawRevenues = array(root.revenueRecords, 'backup.revenueRecords');
  const seen = new Set<string>();
  const assets = rawAssets.map((raw, index) => { const path = `backup.assets[${index}]`; const asset = atPath(path, 'asset', () => validateLegacyAssetV1(raw, today)); uniqueId(asset.id, seen, path); return asset; });
  const records = validateRecords(rawCosts, rawRevenues, assets, today);
  return { format: FORMAT, schemaVersion: 1, exportedAt, currency: 'CNY', assets, ...records };
}

export function validateBackupV2(value: unknown, now = new Date()): BackupV2 {
  const today = localToday(now); const root = object(value, 'backup'); const exportedAt = validateEnvelope(root, 2);
  const rawAssets = array(root.assets, 'backup.assets'); const rawCategories = array(root.categories, 'backup.categories');
  const rawCosts = array(root.costRecords, 'backup.costRecords'); const rawRevenues = array(root.revenueRecords, 'backup.revenueRecords');
  if (rawCategories.length > MAX_CATEGORIES) throw new Error(`backup.categories: 类别不得超过 ${MAX_CATEGORIES} 条`);
  const categoryIds = new Set<string>(); const categoryNames = new Set<string>();
  const categories: Category[] = rawCategories.map((raw, index) => {
    const path = `backup.categories[${index}]`; const category = atPath(path, 'category', () => validateCategory(raw)); uniqueId(category.id, categoryIds, path);
    if (categoryNames.has(category.name)) throw new Error(`${path}.name: 类别名称重复`); categoryNames.add(category.name); return category;
  });
  const assetIds = new Set<string>();
  const assets: AssetV2[] = rawAssets.map((raw, index) => {
    const path = `backup.assets[${index}]`; const asset = atPath(path, 'asset', () => validateAssetV2(raw, today)); uniqueId(asset.id, assetIds, path);
    if (asset.categoryId !== null && !categoryIds.has(asset.categoryId)) throw new Error(`${path}.categoryId: 引用的类别不存在`); return asset;
  });
  const records = validateRecords(rawCosts, rawRevenues, assets, today);
  return { format: FORMAT, schemaVersion: 2, exportedAt, currency: 'CNY', assets, categories, ...records };
}

export function validateBackupV3(value: unknown, now = new Date()): BackupV3 {
  const today = localToday(now); const root = object(value, 'backup'); const exportedAt = validateEnvelope(root, 3);
  const rawAssets = array(root.assets, 'backup.assets'); const rawCategories = array(root.categories, 'backup.categories');
  const rawCosts = array(root.costRecords, 'backup.costRecords'); const rawRevenues = array(root.revenueRecords, 'backup.revenueRecords');
  if (rawCategories.length > MAX_CATEGORIES) throw new Error(`backup.categories: 类别不得超过 ${MAX_CATEGORIES} 条`);
  const categoryIds = new Set<string>(); const categoryNames = new Set<string>();
  const categories: Category[] = rawCategories.map((raw, index) => {
    const path = `backup.categories[${index}]`; const category = atPath(path, 'category', () => validateCategory(raw)); uniqueId(category.id, categoryIds, path);
    if (categoryNames.has(category.name)) throw new Error(`${path}.name: 类别名称重复`); categoryNames.add(category.name); return category;
  });
  const assetIds = new Set<string>();
  const assets: AssetV3[] = rawAssets.map((raw, index) => {
    const path = `backup.assets[${index}]`; const asset = atPath(path, 'asset', () => validateAssetV3(raw, today)); uniqueId(asset.id, assetIds, path);
    if (asset.categoryId !== null && !categoryIds.has(asset.categoryId)) throw new Error(`${path}.categoryId: 引用的类别不存在`); return asset;
  });
  const records = validateRecords(rawCosts, rawRevenues, assets, today);
  return { format: FORMAT, schemaVersion: 3, exportedAt, currency: 'CNY', assets, categories, ...records };
}

export function validateBackupV4(value: unknown, now = new Date()): BackupV4 {
  const today = localToday(now); const root = object(value, 'backup'); const exportedAt = validateEnvelope(root, 4);
  const rawAssets = array(root.assets, 'backup.assets'); const rawCategories = array(root.categories, 'backup.categories');
  const rawCosts = array(root.costRecords, 'backup.costRecords'); const rawRevenues = array(root.revenueRecords, 'backup.revenueRecords');
  if (rawCategories.length > MAX_CATEGORIES) throw new Error(`backup.categories: 类别不得超过 ${MAX_CATEGORIES} 条`);
  const categoryIds = new Set<string>(); const categoryNames = new Set<string>();
  const categories: Category[] = rawCategories.map((raw, index) => {
    const path = `backup.categories[${index}]`; const category = atPath(path, 'category', () => validateCategory(raw)); uniqueId(category.id, categoryIds, path);
    if (categoryNames.has(category.name)) throw new Error(`${path}.name: 类别名称重复`); categoryNames.add(category.name); return category;
  });
  const assetIds = new Set<string>();
  const assets: AssetV4[] = rawAssets.map((raw, index) => {
    const path = `backup.assets[${index}]`; const asset = atPath(path, 'asset', () => validateAssetV4(raw, today)); uniqueId(asset.id, assetIds, path);
    if (asset.categoryId !== null && !categoryIds.has(asset.categoryId)) throw new Error(`${path}.categoryId: 引用的类别不存在`); return asset;
  });
  const records = validateRecords(rawCosts, rawRevenues, assets, today);
  return { format: FORMAT, schemaVersion: 4, exportedAt, currency: 'CNY', assets, categories, ...records };
}

export function validateBackupV5(value: unknown, now = new Date()): BackupV5 {
  const today = localToday(now); const root = object(value, 'backup'); const exportedAt = validateEnvelope(root, 5);
  const rawAssets = array(root.assets, 'backup.assets'); const rawCategories = array(root.categories, 'backup.categories');
  const rawCosts = array(root.costRecords, 'backup.costRecords'); const rawRevenues = array(root.revenueRecords, 'backup.revenueRecords');
  if (rawCategories.length > MAX_CATEGORIES) throw new Error(`backup.categories: 类别不得超过 ${MAX_CATEGORIES} 条`);
  const categoryIds = new Set<string>(); const categoryNames = new Set<string>();
  const categories: Category[] = rawCategories.map((raw, index) => {
    const path = `backup.categories[${index}]`; const category = atPath(path, 'category', () => validateCategory(raw)); uniqueId(category.id, categoryIds, path);
    if (categoryNames.has(category.name)) throw new Error(`${path}.name: 类别名称重复`); categoryNames.add(category.name); return category;
  });
  const assetIds = new Set<string>();
  const assets: Asset[] = rawAssets.map((raw, index) => {
    const path = `backup.assets[${index}]`; const asset = atPath(path, 'asset', () => validateAsset(raw, today)); uniqueId(asset.id, assetIds, path);
    if (asset.categoryId !== null && !categoryIds.has(asset.categoryId)) throw new Error(`${path}.categoryId: 引用的类别不存在`); return asset;
  });
  const records = validateRecords(rawCosts, rawRevenues, assets, today);
  return { format: FORMAT, schemaVersion: 5, exportedAt, currency: 'CNY', assets, categories, ...records };
}

export function validateBackupV6(value: unknown, now = new Date()): BackupV6 {
  const root = object(value, 'backup');
  const exportedAt = validateEnvelope(root, 6);
  const legacy = validateBackupV5(Object.fromEntries(Object.entries(root).filter(([key]) => !['regularItems', 'regularVariants', 'regularPurchases'].includes(key)).map(([key, val]) => [key, key === 'schemaVersion' ? 5 : val])), now);
  const rawItems = array(root.regularItems, 'backup.regularItems');
  const rawVariants = array(root.regularVariants, 'backup.regularVariants');
  const rawPurchases = array(root.regularPurchases, 'backup.regularPurchases');
  if (rawItems.length > MAX_REGULAR_ITEMS || rawVariants.length > MAX_REGULAR_VARIANTS || rawPurchases.length > MAX_REGULAR_PURCHASES) throw new Error('backup: 常买物品记录超过数量上限');
  const itemIds = new Set<string>();
  const regularItems = rawItems.map((raw, index) => { const path = `backup.regularItems[${index}]`; const item = atPath(path, 'regularItem', () => validateRegularItem(raw)); uniqueId(item.id, itemIds, path); return item; });
  const variantIds = new Set<string>();
  const regularVariants = rawVariants.map((raw, index) => { const path = `backup.regularVariants[${index}]`; const variant = atPath(path, 'regularVariant', () => validateRegularVariant(raw)); uniqueId(variant.id, variantIds, path); if (!itemIds.has(variant.itemId)) throw new Error(`${path}.itemId: 引用的物品不存在`); return variant; });
  const purchaseIds = new Set<string>();
  const regularPurchases = rawPurchases.map((raw, index) => { const path = `backup.regularPurchases[${index}]`; const purchase = atPath(path, 'regularPurchase', () => validateRegularPurchase(raw, localToday(now))); uniqueId(purchase.id, purchaseIds, path); if (!variantIds.has(purchase.variantId)) throw new Error(`${path}.variantId: 引用的款式不存在`); return purchase; });
  return { ...legacy, schemaVersion: 6, exportedAt, regularItems, regularVariants, regularPurchases };
}

function upgradeV1(backup: BackupV1): BackupV2 {
  return { ...backup, schemaVersion: 2, categories: [], assets: backup.assets.map(asset => ({ ...asset, categoryId: null, lifecycleStatus: 'active', endedDate: null })) };
}
function upgradeV2(backup: BackupV2): BackupV3 {
  return { ...backup, schemaVersion: 3, assets: backup.assets.map(asset => ({ ...asset, iconId: null })) };
}
function upgradeV3(backup: BackupV3): BackupV4 {
  return { ...backup, schemaVersion: 4, assets: backup.assets.map(asset => ({ ...asset, serviceStartDate: asset.purchaseDate })) };
}
function upgradeV4(backup: BackupV4): BackupV5 {
  return { ...backup, schemaVersion: 5, assets: backup.assets.map(asset => ({ ...asset })) };
}
function upgradeV5(backup: BackupV5): BackupV6 {
  return { ...backup, schemaVersion: 6, regularItems: [], regularVariants: [], regularPurchases: [] };
}
export function validateBackupImport(value: unknown, now = new Date()): BackupImport {
  const root = object(value, 'backup');
  const sourceSchemaVersion = root.schemaVersion;
  const data = sourceSchemaVersion === 1 ? upgradeV5(validateBackupV5(upgradeV4(validateBackupV4(upgradeV3(validateBackupV3(upgradeV2(validateBackupV2(upgradeV1(validateBackupV1(value, now)), now)), now)), now)), now))
    : sourceSchemaVersion === 2 ? upgradeV5(validateBackupV5(upgradeV4(validateBackupV4(upgradeV3(validateBackupV3(upgradeV2(validateBackupV2(value, now)), now)), now)), now))
      : sourceSchemaVersion === 3 ? upgradeV5(validateBackupV5(upgradeV4(validateBackupV4(upgradeV3(validateBackupV3(value, now)), now)), now))
        : sourceSchemaVersion === 4 ? upgradeV5(validateBackupV5(upgradeV4(validateBackupV4(value, now)), now))
          : sourceSchemaVersion === 5 ? upgradeV5(validateBackupV5(value, now))
            : sourceSchemaVersion === 6 ? validateBackupV6(value, now) : null;
  if (data) {
    Object.defineProperty(data, 'sourceSchemaVersion', { value: sourceSchemaVersion, enumerable: false });
    return data as BackupImport;
  }
  throw new Error('backup.schemaVersion: 不支持的备份版本');
}
export function parseBackupJson(json: string, now = new Date()): BackupImport {
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) throw new Error('backup: 文件超过 80 MiB');
  let parsed: unknown; try { parsed = JSON.parse(json) as unknown; } catch { throw new Error('backup: JSON 格式无效或文件为空'); }
  return validateBackupImport(parsed, now);
}
export async function readBackupFile(file: File, now = new Date()): Promise<BackupImport> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('backup: 文件超过 80 MiB');
  let json: string; try { json = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); } catch { throw new Error('backup: 文件读取失败或不是有效 UTF-8'); }
  return parseBackupJson(json, now);
}
export async function getBackupCounts(database: AssetDatabase = db): Promise<BackupCounts> {
  return database.transaction('r', [database.assets, database.categories, database.costRecords, database.revenueRecords, database.regularItems, database.regularVariants, database.regularPurchases], async () => ({
    assets: await database.assets.count(), categories: await database.categories.count(), costRecords: await database.costRecords.count(), revenueRecords: await database.revenueRecords.count(), regularItems: await database.regularItems.count(), regularVariants: await database.regularVariants.count(), regularPurchases: await database.regularPurchases.count(),
  }));
}
export async function exportBackup(database: AssetDatabase = db, now = new Date()): Promise<{ json: string; filename: string }> {
  const snapshot = await database.transaction('r', [database.assets, database.categories, database.costRecords, database.revenueRecords, database.regularItems, database.regularVariants, database.regularPurchases], async () => ({
    assets: await database.assets.toArray(), categories: await database.categories.toArray(), costRecords: await database.costRecords.toArray(), revenueRecords: await database.revenueRecords.toArray(), regularItems: await database.regularItems.toArray(), regularVariants: await database.regularVariants.toArray(), regularPurchases: await database.regularPurchases.toArray(),
  }));
  const byId = <T extends { id: string }>(items: T[]) => items.sort((a, b) => a.id.localeCompare(b.id));
  const backup: BackupV6 = { format: FORMAT, schemaVersion: 6, exportedAt: now.toISOString(), currency: 'CNY', assets: byId(snapshot.assets), categories: byId(snapshot.categories), costRecords: byId(snapshot.costRecords), revenueRecords: byId(snapshot.revenueRecords), regularItems: byId(snapshot.regularItems), regularVariants: byId(snapshot.regularVariants), regularPurchases: byId(snapshot.regularPurchases) };
  const json = JSON.stringify(backup); if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) throw new Error('backup: 导出文件超过 80 MiB');
  const datePart = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('');
  const timePart = [now.getHours(), now.getMinutes(), now.getSeconds()].map(value => String(value).padStart(2, '0')).join('');
  return { json, filename: `asset-cost-backup-${datePart}-${timePart}.json` };
}
export async function replaceFromBackup(candidate: unknown, database: AssetDatabase = db, now = new Date()): Promise<void> {
  const backup = validateBackupImport(candidate, now);
  await database.transaction('rw', [database.assets, database.categories, database.costRecords, database.revenueRecords, database.regularItems, database.regularVariants, database.regularPurchases], async () => {
    await database.assets.clear(); await database.categories.clear(); await database.costRecords.clear(); await database.revenueRecords.clear(); await database.regularItems.clear(); await database.regularVariants.clear(); await database.regularPurchases.clear();
    await database.categories.bulkAdd(backup.categories); await database.assets.bulkAdd(backup.assets); await database.costRecords.bulkAdd(backup.costRecords); await database.revenueRecords.bulkAdd(backup.revenueRecords); await database.regularItems.bulkAdd(backup.regularItems); await database.regularVariants.bulkAdd(backup.regularVariants); await database.regularPurchases.bulkAdd(backup.regularPurchases);
  });
}
