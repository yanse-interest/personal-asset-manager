import { isLocalDate } from './dates';
import { MAX_AMOUNT_CENTS } from './money';
import type { Asset, Category, CostRecord, RevenueRecord, LocalDate, LegacyAssetV1 } from './types';

export const MAX_RECORDS = 5_000;
export const MAX_USAGE_COUNT = 2_147_483_647;
export const MAX_CATEGORIES = 100;

type PlainObject = Record<string, unknown>;

function object(value: unknown, path: string): PlainObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${path}: 必须是普通对象`);
  }
  return value as PlainObject;
}

function exactFields(value: PlainObject, fields: readonly string[], path: string): void {
  for (const field of fields) if (!Object.hasOwn(value, field)) throw new Error(`${path}.${field}: 缺少字段`);
  for (const field of Object.keys(value)) if (!fields.includes(field)) throw new Error(`${path}.${field}: 未知字段`);
}

function string(value: unknown, path: string, min: number, max: number): string {
  if (typeof value !== 'string' || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) {
    throw new Error(`${path}: 必须是有效文本`);
  }
  const trimmed = value.trim();
  const length = [...trimmed].length;
  if (length < min || length > max) throw new Error(`${path}: 长度必须为 ${min}–${max} 字符`);
  return trimmed;
}

function note(value: unknown, path: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error(`${path}: 必须是文本或 null`);
  if (value.trim() === '') return null;
  return string(value, path, 1, 2_000);
}

export function validateUuid(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) {
    throw new Error(`${path}: 必须是小写 UUID v4`);
  }
  return value;
}

export function validateInstant(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new Error(`${path}: 必须是 UTC ISO 时间`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw new Error(`${path}: 时间无效`);
  return value;
}

function localDate(value: unknown, path: string): LocalDate {
  if (!isLocalDate(value)) throw new Error(`${path}: 日期无效`);
  return value;
}

function amount(value: unknown, path: string, allowZero: boolean): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value > MAX_AMOUNT_CENTS || value < (allowZero ? 0 : 1)) {
    throw new Error(`${path}: 金额必须是范围内的整数分`);
  }
  return value;
}

function usageCount(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > MAX_USAGE_COUNT) {
    throw new Error(`${path}: 使用次数必须是范围内的非负整数`);
  }
  return value;
}

function validateLegacyAssetFields(value: unknown, today: LocalDate, path = 'asset'): LegacyAssetV1 {
  localDate(today, 'today');
  const v = object(value, path);
  exactFields(v, ['id', 'name', 'purchaseCostCents', 'purchaseDate', 'costMode', 'usageCount', 'expiryDate', 'note', 'createdAt', 'updatedAt'], path);
  const purchaseDate = localDate(v.purchaseDate, `${path}.purchaseDate`);
  if (purchaseDate > today) throw new Error(`${path}.purchaseDate: 不得晚于今天`);
  const expiryDate = v.expiryDate === null ? null : localDate(v.expiryDate, `${path}.expiryDate`);
  if (expiryDate !== null && expiryDate < purchaseDate) throw new Error(`${path}.expiryDate: 不得早于购买日期`);
  if (v.costMode !== 'day' && v.costMode !== 'use') throw new Error(`${path}.costMode: 未知观察方式`);
  return {
    id: validateUuid(v.id, `${path}.id`),
    name: string(v.name, `${path}.name`, 1, 100),
    purchaseCostCents: amount(v.purchaseCostCents, `${path}.purchaseCostCents`, true),
    purchaseDate,
    costMode: v.costMode,
    usageCount: usageCount(v.usageCount, `${path}.usageCount`),
    expiryDate,
    note: note(v.note, `${path}.note`),
    createdAt: validateInstant(v.createdAt, `${path}.createdAt`),
    updatedAt: validateInstant(v.updatedAt, `${path}.updatedAt`),
  };
}

export function validateLegacyAssetV1(value: unknown, today: LocalDate): LegacyAssetV1 {
  return validateLegacyAssetFields(value, today);
}

export function validateAsset(value: unknown, today: LocalDate): Asset {
  localDate(today, 'today');
  const v = object(value, 'asset');
  exactFields(v, ['id', 'name', 'purchaseCostCents', 'purchaseDate', 'costMode', 'usageCount', 'expiryDate', 'note', 'createdAt', 'updatedAt', 'categoryId', 'lifecycleStatus', 'endedDate'], 'asset');
  const legacy = validateLegacyAssetFields(Object.fromEntries(Object.entries(v).filter(([key]) => !['categoryId', 'lifecycleStatus', 'endedDate'].includes(key))), today);
  const categoryId = v.categoryId === null ? null : validateUuid(v.categoryId, 'asset.categoryId');
  if (v.lifecycleStatus !== 'active' && v.lifecycleStatus !== 'retired' && v.lifecycleStatus !== 'sold') throw new Error('asset.lifecycleStatus: 未知资产状态');
  const endedDate = v.endedDate === null ? null : localDate(v.endedDate, 'asset.endedDate');
  if (v.lifecycleStatus === 'active' && endedDate !== null) throw new Error('asset.endedDate: 服役中资产不得设置结束日期');
  if (v.lifecycleStatus !== 'active' && endedDate === null) throw new Error('asset.endedDate: 已结束资产必须设置结束日期');
  if (endedDate !== null && (endedDate < legacy.purchaseDate || endedDate > today)) throw new Error('asset.endedDate: 必须在购买日至今天之间');
  return { ...legacy, categoryId, lifecycleStatus: v.lifecycleStatus, endedDate };
}

export function validateCategory(value: unknown): Category {
  const v = object(value, 'category');
  exactFields(v, ['id', 'name', 'createdAt', 'updatedAt'], 'category');
  return {
    id: validateUuid(v.id, 'category.id'),
    name: string(v.name, 'category.name', 1, 40),
    createdAt: validateInstant(v.createdAt, 'category.createdAt'),
    updatedAt: validateInstant(v.updatedAt, 'category.updatedAt'),
  };
}

export function validateCostRecord(value: unknown, today: LocalDate, purchaseDate: LocalDate): CostRecord {
  localDate(today, 'today');
  localDate(purchaseDate, 'purchaseDate');
  const v = object(value, 'costRecord');
  exactFields(v, ['id', 'assetId', 'kind', 'amountCents', 'date', 'note', 'createdAt', 'updatedAt'], 'costRecord');
  const date = localDate(v.date, 'costRecord.date');
  if (date < purchaseDate || date > today) throw new Error('costRecord.date: 必须在购买日至今天之间');
  if (v.kind !== 'additional' && v.kind !== 'consumable') throw new Error('costRecord.kind: 未知成本类型');
  return {
    id: validateUuid(v.id, 'costRecord.id'),
    assetId: validateUuid(v.assetId, 'costRecord.assetId'),
    kind: v.kind,
    amountCents: amount(v.amountCents, 'costRecord.amountCents', false),
    date,
    note: note(v.note, 'costRecord.note'),
    createdAt: validateInstant(v.createdAt, 'costRecord.createdAt'),
    updatedAt: validateInstant(v.updatedAt, 'costRecord.updatedAt'),
  };
}

export function validateRevenueRecord(value: unknown, today: LocalDate, purchaseDate: LocalDate): RevenueRecord {
  localDate(today, 'today');
  localDate(purchaseDate, 'purchaseDate');
  const v = object(value, 'revenueRecord');
  exactFields(v, ['id', 'assetId', 'amountCents', 'date', 'note', 'createdAt', 'updatedAt'], 'revenueRecord');
  const date = localDate(v.date, 'revenueRecord.date');
  if (date < purchaseDate || date > today) throw new Error('revenueRecord.date: 必须在购买日至今天之间');
  return {
    id: validateUuid(v.id, 'revenueRecord.id'),
    assetId: validateUuid(v.assetId, 'revenueRecord.assetId'),
    amountCents: amount(v.amountCents, 'revenueRecord.amountCents', false),
    date,
    note: note(v.note, 'revenueRecord.note'),
    createdAt: validateInstant(v.createdAt, 'revenueRecord.createdAt'),
    updatedAt: validateInstant(v.updatedAt, 'revenueRecord.updatedAt'),
  };
}
