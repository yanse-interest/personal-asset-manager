import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssetDatabase } from './db';
import { deleteRegularItem, deleteRegularPurchase, deleteRegularVariant, regularSnapshot, saveRegularItem, saveRegularPurchase, saveRegularVariant } from './regularItems';
import { exportBackup, parseBackupJson, replaceFromBackup } from './backup';
import { purchaseStats } from '../domain/regularItems';

let database: AssetDatabase;
beforeEach(() => { database = new AssetDatabase(`regular-${crypto.randomUUID()}`); });
afterEach(async () => { database.close(); await database.delete(); });

describe('常买物品', () => {
  it('tracks several fixed variants separately and recomputes actual price per piece', async () => {
    const item = await saveRegularItem('咖啡豆', undefined, database);
    const first = await saveRegularVariant({ itemId: item.id, name: '深烘', specification: '250g/包', platform: '平台 A' }, undefined, database);
    const second = await saveRegularVariant({ itemId: item.id, name: '浅烘', specification: '500g/包', platform: '平台 A' }, undefined, database);
    const p1 = await saveRegularPurchase({ variantId: first.id, date: '2026-09-01', quantity: 2, paidYuan: '90.00', note: '' }, undefined, database);
    const p2 = await saveRegularPurchase({ variantId: first.id, date: '2026-09-20', quantity: 1, paidYuan: '42.00', note: '优惠后' }, undefined, database);
    await saveRegularPurchase({ variantId: second.id, date: '2026-09-21', quantity: 1, paidYuan: '70.00', note: '' }, undefined, database);
    await expect(saveRegularVariant({ itemId: item.id, name: '深烘', specification: '500g/包', platform: '平台 A' }, first, database)).rejects.toThrow('不能修改规格');
    await expect(saveRegularVariant({ itemId: item.id, name: '深烘', specification: '250g/包', platform: '平台 A' }, undefined, database)).rejects.toThrow('已存在');
    expect(purchaseStats([p1, p2])).toMatchObject({ count: 2, totalPaidCents: 13_200, totalQuantity: 3, latest: p2, previous: p1, minUnitCents: 4200, maxUnitCents: 4500 });
    expect((await regularSnapshot(database)).purchases).toHaveLength(3);
    await expect(deleteRegularVariant(first, database)).rejects.toThrow('先删除');
    await expect(deleteRegularItem(item, database)).rejects.toThrow('先删除');
    const edited = await saveRegularPurchase({ variantId: first.id, date: p2.date, quantity: 2, paidYuan: '84', note: '' }, p2, database);
    expect(purchaseStats([p1, edited]).minUnitCents).toBe(4200);
    await deleteRegularPurchase(edited, database);
    await deleteRegularPurchase(p1, database);
    await deleteRegularVariant(first, database);
    expect((await regularSnapshot(database)).variants).toEqual([second]);
  });

  it('round trips all new stores and rejects broken backup references without changing data', async () => {
    const item = await saveRegularItem('纸巾', undefined, database);
    const variant = await saveRegularVariant({ itemId: item.id, name: '抽纸', specification: '100抽/包', platform: '店铺' }, undefined, database);
    const purchase = await saveRegularPurchase({ variantId: variant.id, date: '2026-09-20', quantity: 3, paidYuan: '12.30', note: '' }, undefined, database);
    const before = await regularSnapshot(database);
    const backup = parseBackupJson((await exportBackup(database, new Date('2026-09-29T00:00:00.000Z'))).json, new Date('2026-09-29T00:00:00.000Z'));
    expect(backup.sourceSchemaVersion).toBe(6);
    expect(backup.regularItems).toEqual([item]);
    expect(backup.regularVariants).toEqual([variant]);
    expect(backup.regularPurchases).toEqual([purchase]);
    const invalid = structuredClone(backup);
    invalid.regularPurchases[0]!.variantId = crypto.randomUUID();
    await expect(replaceFromBackup(invalid, database, new Date('2026-09-29T00:00:00.000Z'))).rejects.toThrow('variantId');
    expect(await regularSnapshot(database)).toEqual(before);
    await replaceFromBackup(backup, database, new Date('2026-09-29T00:00:00.000Z'));
    expect(await regularSnapshot(database)).toEqual(before);
    const old = Object.fromEntries(Object.entries(backup).filter(([key]) => !['regularItems', 'regularVariants', 'regularPurchases'].includes(key)));
    old.schemaVersion = 5;
    await replaceFromBackup(old, database, new Date('2026-09-29T00:00:00.000Z'));
    expect(await regularSnapshot(database)).toEqual({ items: [], variants: [], purchases: [] });
  });
});
