import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssetDatabase } from './db';
import { MAX_BACKUP_BYTES, exportBackup, parseBackupJson, readBackupFile, replaceFromBackup, validateBackupV1 } from './backup';
import { getDashboardSnapshot } from './queries';
import { createAsset } from './assets';
import type { Asset, BackupV1, CostRecord, RevenueRecord } from '../domain/types';

const now = new Date('2026-09-13T08:00:00.000Z');
const timestamp = now.toISOString();
const assetId = '11111111-1111-4111-8111-111111111111';
const costId = '22222222-2222-4222-8222-222222222222';
const revenueId = '33333333-3333-4333-8333-333333333333';
const asset: Asset = { id: assetId, name: '咖啡机', purchaseCostCents: 100_000, purchaseDate: '2026-09-13', costMode: 'use', usageCount: 3, expiryDate: null, note: '含控制字符\n和 emoji 😀', createdAt: timestamp, updatedAt: timestamp };
const cost: CostRecord = { id: costId, assetId, kind: 'consumable', amountCents: 1, date: '2026-09-13', note: '咖啡豆', createdAt: timestamp, updatedAt: timestamp };
const revenue: RevenueRecord = { id: revenueId, assetId, amountCents: 5, date: '2026-09-13', note: null, createdAt: timestamp, updatedAt: timestamp };
function sample(): BackupV1 { return { format: 'large-asset-cost-backup', schemaVersion: 1, exportedAt: timestamp, currency: 'CNY', assets: [{ ...asset }], costRecords: [{ ...cost }], revenueRecords: [{ ...revenue }] }; }
let database: AssetDatabase;
beforeEach(() => { database = new AssetDatabase(`backup-${crypto.randomUUID()}`); });
afterEach(async () => { database.close(); await database.delete(); });

describe('JSON backup', () => {
  it('exports a sorted, consistent snapshot and restores all fields while removing stale rows', async () => {
    const first = sample();
    const other = { ...asset, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: '打印机' };
    await database.assets.bulkAdd([other, first.assets[0]!]);
    await database.costRecords.add(first.costRecords[0]!);
    await database.revenueRecords.add(first.revenueRecords[0]!);
    const { json, filename } = await exportBackup(database, now);
    expect(filename).toMatch(/^asset-cost-backup-\d{8}-\d{6}\.json$/);
    expect(json).not.toContain('\n');
    const parsed = parseBackupJson(json, now);
    expect(parsed.assets.map(item => item.id)).toEqual([assetId, other.id]);
    await database.assets.delete(other.id);
    await database.revenueRecords.delete(revenueId);
    await replaceFromBackup(parsed, database, now);
    expect(await getDashboardSnapshot(database)).toEqual({ assets: parsed.assets, costs: parsed.costRecords, revenues: parsed.revenueRecords });
  });

  it('accepts an explicit empty backup and rejects empty text', async () => {
    await database.assets.add(asset);
    const empty: BackupV1 = { ...sample(), assets: [], costRecords: [], revenueRecords: [] };
    await replaceFromBackup(empty, database, now);
    expect(await getDashboardSnapshot(database)).toEqual({ assets: [], costs: [], revenues: [] });
    expect(() => parseBackupJson('', now)).toThrow('JSON 格式无效');
  });

  it('rejects malformed files before writing and reports paths', async () => {
    await database.assets.add(asset);
    const previous = await getDashboardSnapshot(database);
    const invalid: Array<[string, (backup: Record<string, unknown>) => void]> = [
      ['backup.schemaVersion', backup => { backup.schemaVersion = 2; }],
      ['backup.currency', backup => { backup.currency = 'USD'; }],
      ['backup.unknown', backup => { backup.unknown = 1; }],
      ['backup.assets[0].name', backup => { (backup.assets as Asset[])[0]!.name = ''; }],
      ['backup.assets[0].usageCount', backup => { (backup.assets as Asset[])[0]!.usageCount = 1.5; }],
      ['backup.assets[0].purchaseCostCents', backup => { (backup.assets as Asset[])[0]!.purchaseCostCents = Number.MAX_SAFE_INTEGER; }],
      ['backup.assets[0].purchaseDate', backup => { (backup.assets as Asset[])[0]!.purchaseDate = '2026-09-14'; }],
      ['backup.costRecords[0].assetId', backup => { (backup.costRecords as CostRecord[])[0]!.assetId = crypto.randomUUID(); }],
      ['backup.costRecords[0].date', backup => { (backup.costRecords as CostRecord[])[0]!.date = '2026-09-12'; }],
      ['backup.revenueRecords[0].amountCents', backup => { (backup.revenueRecords as RevenueRecord[])[0]!.amountCents = 0; }],
      ['backup.revenueRecords[0].extra', backup => { (backup.revenueRecords as Record<string, unknown>[])[0]!.extra = true; }],
    ];
    for (const [path, change] of invalid) {
      const candidate = structuredClone(sample()) as unknown as Record<string, unknown>;
      change(candidate);
      await expect(replaceFromBackup(candidate, database, now), path).rejects.toThrow(path);
      expect(await getDashboardSnapshot(database)).toEqual(previous);
    }
  });

  it('rejects duplicate IDs, too many records, and invalid UTF-8 or oversized files', async () => {
    const duplicate = sample(); duplicate.assets.push({ ...asset });
    expect(() => validateBackupV1(duplicate, now)).toThrow('backup.assets[1].id');
    const tooMany = sample(); tooMany.costRecords = Array.from({ length: 5_000 }, (_, index) => ({ ...cost, id: crypto.randomUUID(), note: String(index) }));
    expect(() => validateBackupV1(tooMany, now)).toThrow('5000');
    const invalidUtf8 = new File([Uint8Array.from([0xff, 0xfe])], 'bad.json');
    await expect(readBackupFile(invalidUtf8, now)).rejects.toThrow('UTF-8');
    const oversized = new File(['{}'], 'large.json');
    Object.defineProperty(oversized, 'size', { value: MAX_BACKUP_BYTES + 1 });
    await expect(readBackupFile(oversized, now)).rejects.toThrow('80 MiB');
  });

  it('rejects missing fields, duplicate record IDs and unpaired surrogate text', () => {
    const missing = sample() as unknown as Record<string, unknown>;
    delete missing.currency;
    expect(() => validateBackupV1(missing, now)).toThrow('backup.currency: 缺少字段');
    const duplicateCost = sample(); duplicateCost.costRecords.push({ ...cost });
    expect(() => validateBackupV1(duplicateCost, now)).toThrow('backup.costRecords[1].id');
    const duplicateRevenue = sample(); duplicateRevenue.revenueRecords.push({ ...revenue });
    expect(() => validateBackupV1(duplicateRevenue, now)).toThrow('backup.revenueRecords[1].id');
    const invalidText = sample(); invalidText.assets[0]!.note = '\uD800';
    expect(() => validateBackupV1(invalidText, now)).toThrow('backup.assets[0].note');
  });

  it('normalizes empty notes and round-trips maximum-length escaped text', () => {
    const backup = sample();
    backup.assets[0]!.note = '"😀\n'.repeat(666) + 'xy';
    backup.costRecords[0]!.note = '';
    const parsed = parseBackupJson(JSON.stringify(backup), now);
    expect(parsed.assets[0]!.note).toBe(backup.assets[0]!.note);
    expect(parsed.costRecords[0]!.note).toBeNull();
    expect(parseBackupJson(JSON.stringify(parsed), now)).toEqual(parsed);
  });

  it('accepts exactly 5,000 records with maximum escaped notes', async () => {
    const note = '"😀\n'.repeat(666) + 'xy';
    const backup = sample();
    backup.assets[0]!.note = note;
    backup.costRecords = Array.from({ length: 4_998 }, (_, index) => ({ ...cost, id: crypto.randomUUID(), note, amountCents: index + 1 }));
    backup.revenueRecords[0]!.note = note;
    const json = JSON.stringify(backup);
    expect(new TextEncoder().encode(json).byteLength).toBeLessThan(MAX_BACKUP_BYTES);
    const parsed = parseBackupJson(json, now);
    expect(parsed.assets.length + parsed.costRecords.length + parsed.revenueRecords.length).toBe(5_000);
    expect(parsed.assets[0]!.note).toBe(note);
    expect(parsed.costRecords.at(-1)!.note).toBe(note);
    await replaceFromBackup(parsed, database, now);
    const roundTrip = parseBackupJson((await exportBackup(database, now)).json, now);
    expect(roundTrip.assets).toEqual(parsed.assets);
    expect(roundTrip.costRecords).toEqual([...parsed.costRecords].sort((left, right) => left.id.localeCompare(right.id)));
    expect(roundTrip.revenueRecords).toEqual(parsed.revenueRecords);
  });

  it('replaces changes made by another connection after preview instead of merging', async () => {
    const preview = validateBackupV1(sample(), now);
    const otherConnection = new AssetDatabase(database.name);
    try {
      await createAsset({ name: '其他标签新增', purchaseCost: '50', purchaseDate: '2026-09-13', costMode: 'day', expiryDate: null, note: null }, otherConnection, now);
      await replaceFromBackup(preview, database, now);
      expect(await database.assets.toArray()).toEqual(preview.assets);
      expect(await database.costRecords.toArray()).toEqual(preview.costRecords);
      expect(await database.revenueRecords.toArray()).toEqual(preview.revenueRecords);
    } finally { otherConnection.close(); }
  });

  it('rolls back all three tables if writing fails after clear and earlier inserts', async () => {
    const original = sample();
    await database.assets.add({ ...asset, name: '旧资产' });
    await database.costRecords.add({ ...cost, amountCents: 20 });
    await database.revenueRecords.add({ ...revenue, amountCents: 10 });
    const previous = await getDashboardSnapshot(database);
    const fail = () => { throw new Error('forced quota failure'); };
    database.revenueRecords.hook('creating').subscribe(fail);
    await expect(replaceFromBackup(original, database, now)).rejects.toThrow('forced quota failure');
    database.revenueRecords.hook('creating').unsubscribe(fail);
    expect(await getDashboardSnapshot(database)).toEqual(previous);
  });

  it('exports either side of a concurrent atomic asset-plus-record write without an orphan', async () => {
    const created = await createAsset({ name: '设备', purchaseCost: '100', purchaseDate: '2026-09-13', costMode: 'day', expiryDate: null, note: null }, database, now);
    const secondAsset = { ...asset, id: crypto.randomUUID() };
    const secondCost = { ...cost, id: crypto.randomUUID(), assetId: secondAsset.id };
    const write = database.transaction('rw', database.assets, database.costRecords, async () => {
      await database.assets.add(secondAsset); await database.costRecords.add(secondCost);
    });
    const exported = exportBackup(database, now);
    await write;
    const parsed = parseBackupJson((await exported).json, now);
    expect(parsed.assets.some(item => item.id === created.id)).toBe(true);
    for (const record of parsed.costRecords) expect(parsed.assets.some(item => item.id === record.assetId)).toBe(true);
  });
});
