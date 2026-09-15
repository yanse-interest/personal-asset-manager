import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssetDatabase } from './db';
import { MAX_BACKUP_BYTES, exportBackup, parseBackupJson, readBackupFile, replaceFromBackup, validateBackupImport, validateBackupV1 } from './backup';
import { getDashboardSnapshot } from './queries';
import type { Asset, AssetV2, BackupV1, BackupV2, BackupV3, Category, CostRecord, LegacyAssetV1, RevenueRecord } from '../domain/types';

const now = new Date('2026-09-13T08:00:00.000Z');
const timestamp = now.toISOString();
const assetId = '11111111-1111-4111-8111-111111111111';
const categoryId = '44444444-4444-4444-8444-444444444444';
const legacyAsset: LegacyAssetV1 = { id: assetId, name: '咖啡机', purchaseCostCents: 100_000, purchaseDate: '2026-09-13', costMode: 'use', usageCount: 3, expiryDate: null, note: '含控制字符\n和 emoji 😀', createdAt: timestamp, updatedAt: timestamp };
const assetV2: AssetV2 = { ...legacyAsset, categoryId, lifecycleStatus: 'sold', endedDate: '2026-09-13' };
const asset: Asset = { ...assetV2, iconId: null };
const category: Category = { id: categoryId, name: '数码', createdAt: timestamp, updatedAt: timestamp };
const cost: CostRecord = { id: '22222222-2222-4222-8222-222222222222', assetId, kind: 'consumable', amountCents: 1, date: '2026-09-13', note: '咖啡豆', createdAt: timestamp, updatedAt: timestamp };
const revenue: RevenueRecord = { id: '33333333-3333-4333-8333-333333333333', assetId, amountCents: 5, date: '2026-09-13', note: null, createdAt: timestamp, updatedAt: timestamp };
const sampleV1 = (): BackupV1 => ({ format: 'large-asset-cost-backup', schemaVersion: 1, exportedAt: timestamp, currency: 'CNY', assets: [{ ...legacyAsset }], costRecords: [{ ...cost }], revenueRecords: [{ ...revenue }] });
const sampleV2 = (): BackupV2 => ({ format: 'large-asset-cost-backup', schemaVersion: 2, exportedAt: timestamp, currency: 'CNY', assets: [{ ...assetV2 }], categories: [{ ...category }], costRecords: [{ ...cost }], revenueRecords: [{ ...revenue }] });
const sampleV3 = (): BackupV3 => ({ ...sampleV2(), schemaVersion: 3, assets: [{ ...asset }] });
let database: AssetDatabase;
beforeEach(() => { database = new AssetDatabase(`backup-${crypto.randomUUID()}`); });
afterEach(async () => { database.close(); await database.delete(); });

describe('v1/v2/v3 JSON backup', () => {
  it('validates frozen v1 fields then upgrades in memory without changing history', async () => {
    const imported = parseBackupJson(JSON.stringify(sampleV1()), now);
    expect(imported.sourceSchemaVersion).toBe(1);
    expect(imported.assets[0]).toEqual({ ...legacyAsset, categoryId: null, lifecycleStatus: 'active', endedDate: null, iconId: null });
    expect(imported.categories).toEqual([]);
    await database.categories.add(category);
    await replaceFromBackup(imported, database, now);
    expect(await database.categories.count()).toBe(0);
    expect(await database.assets.get(assetId)).toEqual(imported.assets[0]);
    expect(await database.costRecords.toArray()).toEqual([cost]);
    expect(await database.revenueRecords.toArray()).toEqual([revenue]);
  });

  it('exports and restores all four stores exactly, sorted by ID', async () => {
    await replaceFromBackup(sampleV2(), database, now);
    const { json, filename } = await exportBackup(database, now);
    expect(filename).toMatch(/^asset-cost-backup-\d{8}-\d{6}\.json$/);
    const parsed = parseBackupJson(json, now);
    expect(parsed.sourceSchemaVersion).toBe(3);
    expect(parsed.categories).toEqual([category]);
    await database.assets.clear(); await database.categories.clear();
    await replaceFromBackup(parsed, database, now);
    expect(await getDashboardSnapshot(database)).toEqual({ assets: [asset], categories: [category], costs: [cost], revenues: [revenue] });
  });

  it('rejects invalid v2 facts before any write', async () => {
    await replaceFromBackup(sampleV2(), database, now);
    const previous = await getDashboardSnapshot(database);
    const cases: Array<[string, (backup: BackupV2) => void]> = [
      ['backup.assets[0].categoryId', b => { b.assets[0]!.categoryId = crypto.randomUUID(); }],
      ['backup.assets[0].lifecycleStatus', b => { (b.assets[0] as unknown as Record<string, unknown>).lifecycleStatus = 'missing'; }],
      ['backup.assets[0].endedDate', b => { b.assets[0]!.endedDate = null; }],
      ['backup.categories[1].name', b => { b.categories.push({ ...category, id: crypto.randomUUID() }); }],
      ['backup.costRecords[0].assetId', b => { b.costRecords[0]!.assetId = crypto.randomUUID(); }],
      ['backup.revenueRecords[0].amountCents', b => { b.revenueRecords[0]!.amountCents = 0; }],
    ];
    for (const [path, mutate] of cases) {
      const candidate = structuredClone(sampleV2()); mutate(candidate);
      await expect(replaceFromBackup(candidate, database, now), path).rejects.toThrow(path);
      expect(await getDashboardSnapshot(database)).toEqual(previous);
    }
    await expect(replaceFromBackup({ ...sampleV2(), schemaVersion: 4 }, database, now)).rejects.toThrow('schemaVersion');
    expect(await getDashboardSnapshot(database)).toEqual(previous);
  });

  it('keeps chosen icons through v3 export and restore while v2 imports get auto icons', async () => {
    const withIcon = sampleV3(); withIcon.assets[0]!.iconId = '3d:laptop';
    await replaceFromBackup(withIcon, database, now);
    const exported = parseBackupJson((await exportBackup(database, now)).json, now);
    expect(exported.sourceSchemaVersion).toBe(3);
    expect(exported.assets[0]?.iconId).toBe('3d:laptop');
    await replaceFromBackup(sampleV2(), database, now);
    expect((await database.assets.get(assetId))?.iconId).toBeNull();
    await replaceFromBackup(exported, database, now);
    expect((await database.assets.get(assetId))?.iconId).toBe('3d:laptop');
    const invalid = sampleV3(); invalid.assets[0]!.iconId = '3d:unknown';
    await expect(replaceFromBackup(invalid, database, now)).rejects.toThrow('iconId');
  });

  it('rejects invalid frozen v1 fields, duplicate ids, excess rows and malformed files', async () => {
    const broken = sampleV1(); (broken.assets[0] as unknown as Record<string, unknown>).categoryId = null;
    expect(() => validateBackupV1(broken, now)).toThrow('backup.assets[0].categoryId');
    const duplicate = sampleV1(); duplicate.assets.push({ ...legacyAsset });
    expect(() => validateBackupV1(duplicate, now)).toThrow('backup.assets[1].id');
    const tooMany = sampleV1(); tooMany.costRecords = Array.from({ length: 5000 }, () => ({ ...cost, id: crypto.randomUUID() }));
    expect(() => validateBackupImport(tooMany, now)).toThrow('5000');
    await expect(readBackupFile(new File([Uint8Array.from([0xff])], 'bad.json'), now)).rejects.toThrow('UTF-8');
    const oversized = new File(['{}'], 'large.json'); Object.defineProperty(oversized, 'size', { value: MAX_BACKUP_BYTES + 1 });
    await expect(readBackupFile(oversized, now)).rejects.toThrow('80 MiB');
    expect(() => parseBackupJson('', now)).toThrow('JSON 格式无效');
  });

  it('accepts 5,000 records, 100 categories and the 80 MiB budget', async () => {
    const note = '"😀\n'.repeat(666) + 'xy';
    const backup = sampleV2(); backup.assets[0]!.note = note;
    backup.categories = Array.from({ length: 100 }, (_, index) => ({ ...category, id: crypto.randomUUID(), name: `类别${index}` }));
    backup.assets[0]!.categoryId = backup.categories[0]!.id;
    backup.costRecords = Array.from({ length: 4_998 }, (_, index) => ({ ...cost, id: crypto.randomUUID(), amountCents: index + 1, note }));
    backup.revenueRecords[0]!.note = note;
    const json = JSON.stringify(backup);
    expect(new TextEncoder().encode(json).byteLength).toBeLessThan(MAX_BACKUP_BYTES);
    const parsed = parseBackupJson(json, now);
    expect(parsed.assets.length + parsed.costRecords.length + parsed.revenueRecords.length).toBe(5_000);
    await replaceFromBackup(parsed, database, now);
    expect(await database.categories.count()).toBe(100);
    expect(parseBackupJson((await exportBackup(database, now)).json, now).costRecords).toHaveLength(4_998);
  });

  it('rolls back all four tables when the final insert fails', async () => {
    const original = sampleV2(); await replaceFromBackup(original, database, now);
    const previous = await getDashboardSnapshot(database);
    const fail = () => { throw new Error('forced failure'); };
    database.revenueRecords.hook('creating').subscribe(fail);
    await expect(replaceFromBackup(original, database, now)).rejects.toThrow('forced failure');
    database.revenueRecords.hook('creating').unsubscribe(fail);
    expect(await getDashboardSnapshot(database)).toEqual(previous);
  });
});
