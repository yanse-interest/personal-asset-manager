import type { Category } from '../domain/types';
import { MAX_CATEGORIES, validateCategory } from '../domain/validation';
import { db, type AssetDatabase } from './db';

export interface CategoryDeleteSnapshot { category: Category; assetIds: string[] }
export class CategoryConflictError extends Error {
  constructor(message = '类别已在其他页面修改，请刷新后重试。') { super(message); this.name = 'CategoryConflictError'; }
}
const sameCategory = (a: Category, b: Category) => Object.keys(a).every(key => a[key as keyof Category] === b[key as keyof Category]);
const makeCategory = (name: string, now: Date, current?: Category) => validateCategory({
  id: current?.id ?? crypto.randomUUID(), name, createdAt: current?.createdAt ?? now.toISOString(), updatedAt: now.toISOString(),
});

export const listCategories = (database: AssetDatabase = db) => database.categories.orderBy('name').toArray();

export async function createCategory(name: string, database: AssetDatabase = db, now = new Date()): Promise<Category> {
  const category = makeCategory(name, now);
  return database.transaction('rw', database.categories, async () => {
    if (await database.categories.count() >= MAX_CATEGORIES) throw new Error(`类别最多保存 ${MAX_CATEGORIES} 条。`);
    if (await database.categories.where('name').equals(category.name).first()) throw new Error('类别名称已存在。');
    await database.categories.add(category); return category;
  });
}

export async function renameCategory(expected: Category, name: string, database: AssetDatabase = db, now = new Date()): Promise<Category> {
  const updated = makeCategory(name, now, expected);
  return database.transaction('rw', database.categories, async () => {
    const current = await database.categories.get(expected.id);
    if (!current || !sameCategory(current, expected)) throw new CategoryConflictError();
    const duplicate = await database.categories.where('name').equals(updated.name).first();
    if (duplicate && duplicate.id !== expected.id) throw new Error('类别名称已存在。');
    await database.categories.put(updated); return updated;
  });
}

export async function getCategoryDeleteSnapshot(id: string, database: AssetDatabase = db): Promise<CategoryDeleteSnapshot | null> {
  return database.transaction('r', database.categories, database.assets, async () => {
    const category = await database.categories.get(id); if (!category) return null;
    const assetIds = (await database.assets.filter(asset => asset.categoryId === id).primaryKeys()).sort();
    return { category, assetIds };
  });
}

export async function deleteCategory(snapshot: CategoryDeleteSnapshot, database: AssetDatabase = db, now = new Date()): Promise<void> {
  await database.transaction('rw', database.categories, database.assets, async () => {
    const current = await database.categories.get(snapshot.category.id);
    const assetIds = (await database.assets.filter(asset => asset.categoryId === snapshot.category.id).primaryKeys()).sort();
    if (!current || !sameCategory(current, snapshot.category) || assetIds.join('\0') !== snapshot.assetIds.join('\0')) throw new CategoryConflictError('类别或关联资产已变化，请核对后再次确认。');
    await database.assets.filter(asset => asset.categoryId === snapshot.category.id).modify({ categoryId: null, updatedAt: now.toISOString() });
    await database.categories.delete(snapshot.category.id);
  });
}
