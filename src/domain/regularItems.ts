import { isLocalDate } from './dates';
import { MAX_AMOUNT_CENTS } from './money';
import type { RegularItem, RegularPurchase, RegularVariant } from './types';
import { validateInstant, validateUuid } from './validation';

export const MAX_REGULAR_ITEMS = 200;
export const MAX_REGULAR_VARIANTS = 500;
export const MAX_REGULAR_PURCHASES = 5_000;

function record(value: unknown, path: string, fields: string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error(`${path}: 必须是普通对象`);
  const input = value as Record<string, unknown>;
  for (const field of fields) if (!Object.hasOwn(input, field)) throw new Error(`${path}.${field}: 缺少字段`);
  for (const field of Object.keys(input)) if (!fields.includes(field)) throw new Error(`${path}.${field}: 未知字段`);
  return input;
}

function text(value: unknown, path: string, max: number): string {
  if (typeof value !== 'string' || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) throw new Error(`${path}: 必须是有效文本`);
  const result = value.trim();
  if ([...result].length < 1 || [...result].length > max) throw new Error(`${path}: 长度必须为 1–${max} 字符`);
  return result;
}

export function validateRegularItem(value: unknown): RegularItem {
  const v = record(value, 'regularItem', ['id', 'name', 'createdAt', 'updatedAt']);
  return { id: validateUuid(v.id, 'regularItem.id'), name: text(v.name, 'regularItem.name', 100), createdAt: validateInstant(v.createdAt, 'regularItem.createdAt'), updatedAt: validateInstant(v.updatedAt, 'regularItem.updatedAt') };
}

export function validateRegularVariant(value: unknown): RegularVariant {
  const v = record(value, 'regularVariant', ['id', 'itemId', 'name', 'specification', 'platform', 'createdAt', 'updatedAt']);
  return { id: validateUuid(v.id, 'regularVariant.id'), itemId: validateUuid(v.itemId, 'regularVariant.itemId'), name: text(v.name, 'regularVariant.name', 100), specification: text(v.specification, 'regularVariant.specification', 60), platform: text(v.platform, 'regularVariant.platform', 60), createdAt: validateInstant(v.createdAt, 'regularVariant.createdAt'), updatedAt: validateInstant(v.updatedAt, 'regularVariant.updatedAt') };
}

export function validateRegularPurchase(value: unknown, today: string): RegularPurchase {
  const v = record(value, 'regularPurchase', ['id', 'variantId', 'date', 'quantity', 'paidCents', 'note', 'createdAt', 'updatedAt']);
  if (!isLocalDate(v.date) || v.date > today) throw new Error('regularPurchase.date: 日期无效或晚于今天');
  if (!Number.isSafeInteger(v.quantity) || (v.quantity as number) < 1 || (v.quantity as number) > 100_000) throw new Error('regularPurchase.quantity: 数量必须是 1–100000 的整数');
  if (!Number.isSafeInteger(v.paidCents) || (v.paidCents as number) < 1 || (v.paidCents as number) > MAX_AMOUNT_CENTS) throw new Error('regularPurchase.paidCents: 金额必须是范围内的整数分');
  let note: string | null = null;
  if (v.note !== null) {
    if (typeof v.note !== 'string') throw new Error('regularPurchase.note: 必须是文本或 null');
    note = v.note.trim() ? text(v.note, 'regularPurchase.note', 500) : null;
  }
  return { id: validateUuid(v.id, 'regularPurchase.id'), variantId: validateUuid(v.variantId, 'regularPurchase.variantId'), date: v.date, quantity: v.quantity as number, paidCents: v.paidCents as number, note, createdAt: validateInstant(v.createdAt, 'regularPurchase.createdAt'), updatedAt: validateInstant(v.updatedAt, 'regularPurchase.updatedAt') };
}

export function sortPurchases(purchases: readonly RegularPurchase[]): RegularPurchase[] {
  return [...purchases].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export function purchaseStats(purchases: readonly RegularPurchase[]) {
  const sorted = sortPurchases(purchases);
  const totalPaidCents = sorted.reduce((sum, row) => sum + row.paidCents, 0);
  const totalQuantity = sorted.reduce((sum, row) => sum + row.quantity, 0);
  const unitPrices = sorted.map(row => row.paidCents / row.quantity);
  return {
    count: sorted.length, totalPaidCents, totalQuantity,
    latest: sorted[0] ?? null, previous: sorted[1] ?? null,
    minUnitCents: unitPrices.length ? Math.min(...unitPrices) : null,
    maxUnitCents: unitPrices.length ? Math.max(...unitPrices) : null,
  };
}
