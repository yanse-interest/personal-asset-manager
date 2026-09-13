import { isLocalDate } from './dates';
import { MAX_AMOUNT_CENTS } from './money';
import type { Asset, CostRecord, RevenueRecord, LocalDate } from './types';

export const MAX_RECORDS = 5_000;
export const MAX_USAGE_COUNT = 2_147_483_647;

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

function uuid(value: unknown, path: string): string {
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

export function validateAsset(value: unknown, today: LocalDate): Asset {
  localDate(today, 'today');
  const v = object(value, 'asset');
  exactFields(v, ['id', 'name', 'purchaseCostCents', 'purchaseDate', 'costMode', 'usageCount', 'expiryDate', 'note', 'createdAt', 'updatedAt'], 'asset');
  const purchaseDate = localDate(v.purchaseDate, 'asset.purchaseDate');
  if (purchaseDate > today) throw new Error('asset.purchaseDate: 不得晚于今天');
  const expiryDate = v.expiryDate === null ? null : localDate(v.expiryDate, 'asset.expiryDate');
  if (expiryDate !== null && expiryDate < purchaseDate) throw new Error('asset.expiryDate: 不得早于购买日期');
  if (v.costMode !== 'day' && v.costMode !== 'use') throw new Error('asset.costMode: 未知观察方式');
  return {
    id: uuid(v.id, 'asset.id'),
    name: string(v.name, 'asset.name', 1, 100),
    purchaseCostCents: amount(v.purchaseCostCents, 'asset.purchaseCostCents', true),
    purchaseDate,
    costMode: v.costMode,
    usageCount: usageCount(v.usageCount, 'asset.usageCount'),
    expiryDate,
    note: note(v.note, 'asset.note'),
    createdAt: validateInstant(v.createdAt, 'asset.createdAt'),
    updatedAt: validateInstant(v.updatedAt, 'asset.updatedAt'),
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
    id: uuid(v.id, 'costRecord.id'),
    assetId: uuid(v.assetId, 'costRecord.assetId'),
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
    id: uuid(v.id, 'revenueRecord.id'),
    assetId: uuid(v.assetId, 'revenueRecord.assetId'),
    amountCents: amount(v.amountCents, 'revenueRecord.amountCents', false),
    date,
    note: note(v.note, 'revenueRecord.note'),
    createdAt: validateInstant(v.createdAt, 'revenueRecord.createdAt'),
    updatedAt: validateInstant(v.updatedAt, 'revenueRecord.updatedAt'),
  };
}
