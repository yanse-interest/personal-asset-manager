import { localToday } from '../domain/dates';
import { parseYuan } from '../domain/money';
import { MAX_REGULAR_ITEMS, MAX_REGULAR_PURCHASES, MAX_REGULAR_VARIANTS, validateRegularItem, validateRegularPurchase, validateRegularVariant } from '../domain/regularItems';
import type { RegularItem, RegularPurchase, RegularVariant } from '../domain/types';
import { db, type AssetDatabase } from './db';

export async function regularSnapshot(database: AssetDatabase = db) {
  return database.transaction('r', database.regularItems, database.regularVariants, database.regularPurchases, async () => ({
    items: await database.regularItems.toArray(), variants: await database.regularVariants.toArray(), purchases: await database.regularPurchases.toArray(),
  }));
}

export async function saveRegularItem(name: string, existing?: RegularItem, database: AssetDatabase = db): Promise<RegularItem> {
  const now = new Date().toISOString();
  const item = validateRegularItem({ id: existing?.id ?? crypto.randomUUID(), name, createdAt: existing?.createdAt ?? now, updatedAt: now });
  await database.transaction('rw', database.regularItems, async () => {
    if ((await database.regularItems.toArray()).some(row => row.id !== item.id && row.name === item.name)) throw new Error('这个常买物品已存在，请在现有物品下添加款式。');
    if (existing) {
      const current = await database.regularItems.get(existing.id);
      if (!current || current.updatedAt !== existing.updatedAt) throw new Error('常买物品已在其他页面修改，请刷新后重试。');
      await database.regularItems.put(item);
    } else {
      if (await database.regularItems.count() >= MAX_REGULAR_ITEMS) throw new Error(`常买物品最多 ${MAX_REGULAR_ITEMS} 个`);
      await database.regularItems.add(item);
    }
  });
  return item;
}

export async function saveRegularVariant(input: Pick<RegularVariant, 'itemId' | 'name' | 'specification' | 'platform'>, existing?: RegularVariant, database: AssetDatabase = db): Promise<RegularVariant> {
  const now = new Date().toISOString();
  const variant = validateRegularVariant({ ...input, id: existing?.id ?? crypto.randomUUID(), createdAt: existing?.createdAt ?? now, updatedAt: now });
  await database.transaction('rw', database.regularItems, database.regularVariants, database.regularPurchases, async () => {
    if (!await database.regularItems.get(variant.itemId)) throw new Error('常买物品不存在，请刷新后重试。');
    const siblings = await database.regularVariants.where('itemId').equals(variant.itemId).toArray();
    if (siblings.some(row => row.id !== variant.id && row.name === variant.name && row.specification === variant.specification && row.platform === variant.platform)) throw new Error('这款商品已存在，请直接记录新购买。');
    if (existing) {
      const current = await database.regularVariants.get(existing.id);
      if (!current || current.updatedAt !== existing.updatedAt || current.itemId !== variant.itemId) throw new Error('款式已在其他页面修改，请刷新后重试。');
      if ((current.specification !== variant.specification || current.platform !== variant.platform) && await database.regularPurchases.where('variantId').equals(existing.id).count()) throw new Error('已有购买记录的款式不能修改规格或平台；请新建款式以便正确比较价格。');
      await database.regularVariants.put(variant);
    } else {
      if (await database.regularVariants.count() >= MAX_REGULAR_VARIANTS) throw new Error(`款式最多 ${MAX_REGULAR_VARIANTS} 个`);
      await database.regularVariants.add(variant);
    }
  });
  return variant;
}

export async function saveRegularPurchase(input: { variantId: string; date: string; quantity: number; paidYuan: string; note: string }, existing?: RegularPurchase, database: AssetDatabase = db): Promise<RegularPurchase> {
  const now = new Date().toISOString();
  const purchase = validateRegularPurchase({ id: existing?.id ?? crypto.randomUUID(), variantId: input.variantId, date: input.date, quantity: input.quantity, paidCents: parseYuan(input.paidYuan), note: input.note.trim() || null, createdAt: existing?.createdAt ?? now, updatedAt: now }, localToday());
  await database.transaction('rw', database.regularVariants, database.regularPurchases, async () => {
    if (!await database.regularVariants.get(purchase.variantId)) throw new Error('款式不存在，请刷新后重试。');
    if (existing) {
      const current = await database.regularPurchases.get(existing.id);
      if (!current || current.updatedAt !== existing.updatedAt || current.variantId !== purchase.variantId) throw new Error('购买记录已在其他页面修改，请刷新后重试。');
      await database.regularPurchases.put(purchase);
    } else {
      if (await database.regularPurchases.count() >= MAX_REGULAR_PURCHASES) throw new Error(`购买记录最多 ${MAX_REGULAR_PURCHASES} 条`);
      await database.regularPurchases.add(purchase);
    }
  });
  return purchase;
}

export async function deleteRegularPurchase(existing: RegularPurchase, database: AssetDatabase = db): Promise<void> {
  await database.transaction('rw', database.regularPurchases, async () => {
    const current = await database.regularPurchases.get(existing.id);
    if (!current || current.updatedAt !== existing.updatedAt) throw new Error('购买记录已变化，请刷新后重试。');
    await database.regularPurchases.delete(existing.id);
  });
}

export async function deleteRegularVariant(existing: RegularVariant, database: AssetDatabase = db): Promise<void> {
  await database.transaction('rw', database.regularVariants, database.regularPurchases, async () => {
    const current = await database.regularVariants.get(existing.id);
    if (!current || current.updatedAt !== existing.updatedAt) throw new Error('款式已变化，请刷新后重试。');
    if (await database.regularPurchases.where('variantId').equals(existing.id).count()) throw new Error('请先删除这款的购买记录。');
    await database.regularVariants.delete(existing.id);
  });
}

export async function deleteRegularItem(existing: RegularItem, database: AssetDatabase = db): Promise<void> {
  await database.transaction('rw', database.regularItems, database.regularVariants, async () => {
    const current = await database.regularItems.get(existing.id);
    if (!current || current.updatedAt !== existing.updatedAt) throw new Error('常买物品已变化，请刷新后重试。');
    if (await database.regularVariants.where('itemId').equals(existing.id).count()) throw new Error('请先删除物品下的款式。');
    await database.regularItems.delete(existing.id);
  });
}
