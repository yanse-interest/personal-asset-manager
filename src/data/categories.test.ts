import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAsset, updateAsset } from './assets';
import { createCategory, deleteCategory, getCategoryDeleteSnapshot, renameCategory } from './categories';
import { AssetDatabase } from './db';

const now = new Date('2026-09-13T08:00:00.000Z');
const input = { name: '咖啡机', purchaseCost: '1000', purchaseDate: '2026-09-13', costMode: 'day' as const, expiryDate: null, note: null };
let database: AssetDatabase;
beforeEach(() => { database = new AssetDatabase(`categories-${crypto.randomUUID()}`); });
afterEach(async () => { database.close(); await database.delete(); });

describe('category management', () => {
  it('trims, renames and preserves linked asset and record facts', async () => {
    const category = await createCategory(' 数码 ', database, now);
    expect(category.name).toBe('数码');
    const asset = await createAsset({ ...input, categoryId: category.id }, database, now);
    const renamed = await renameCategory(category, ' 家电 ', database, new Date('2026-09-13T09:00:00.000Z'));
    expect(renamed).toMatchObject({ id: category.id, name: '家电', createdAt: category.createdAt });
    expect(await database.assets.get(asset.id)).toEqual(asset);
    await expect(createCategory(' 家电 ', database, now)).rejects.toThrow('已存在');
  });

  it('rejects a missing category and stale form after concurrent deletion', async () => {
    const category = await createCategory('数码', database, now);
    const asset = await createAsset({ ...input, categoryId: category.id }, database, now);
    const snapshot = (await getCategoryDeleteSnapshot(category.id, database))!;
    await deleteCategory(snapshot, database, now);
    expect((await database.assets.get(asset.id))?.categoryId).toBeNull();
    await expect(createAsset({ ...input, categoryId: category.id }, database, now)).rejects.toThrow('类别已不存在');
    await expect(updateAsset(asset.id, asset, { ...input, categoryId: category.id }, database, now)).rejects.toThrow('资产已在其他页面修改');
  });

  it('requires a fresh delete snapshot and rolls back reassignment if deletion fails', async () => {
    const category = await createCategory('数码', database, now);
    const asset = await createAsset({ ...input, categoryId: category.id }, database, now);
    const stale = (await getCategoryDeleteSnapshot(category.id, database))!;
    await createAsset({ ...input, name: '第二件', categoryId: category.id }, database, now);
    await expect(deleteCategory(stale, database, now)).rejects.toThrow('已变化');
    const fresh = (await getCategoryDeleteSnapshot(category.id, database))!;
    const fail = () => { throw new Error('forced failure'); };
    database.categories.hook('deleting').subscribe(fail);
    await expect(deleteCategory(fresh, database, now)).rejects.toThrow('forced failure');
    database.categories.hook('deleting').unsubscribe(fail);
    expect((await database.assets.get(asset.id))?.categoryId).toBe(category.id);
    expect(await database.categories.get(category.id)).toEqual(category);
  });

  it('enforces 100 category limit and rejects stale rename', async () => {
    const first = await createCategory('类别 0', database, now);
    await database.categories.bulkAdd(Array.from({ length: 99 }, (_, index) => ({ ...first, id: crypto.randomUUID(), name: `类别 ${index + 1}` })));
    await expect(createCategory('超限', database, now)).rejects.toThrow('100');
    await database.categories.delete(first.id);
    await renameCategory(first, '已变更', database, now).catch(() => undefined);
    await expect(renameCategory(first, '旧表单', database, now)).rejects.toThrow('其他页面修改');
  });
});
