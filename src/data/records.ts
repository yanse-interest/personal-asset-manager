import { localToday } from '../domain/dates';
import { parseYuan } from '../domain/money';
import type { CostKind, CostRecord, LocalDate, RevenueRecord } from '../domain/types';
import { MAX_RECORDS, validateCostRecord, validateRevenueRecord } from '../domain/validation';
import { db, type AssetDatabase } from './db';

export type RecordType = CostKind | 'revenue';
export interface RecordInput { type: RecordType; amount: string; date: LocalDate; note: string | null }
export type RecordSnapshot = { table: 'cost'; record: CostRecord } | { table: 'revenue'; record: RevenueRecord };

export class RecordConflictError extends Error {
  constructor(message = '流水已在其他页面修改，请重新载入后核对。') { super(message); this.name = 'RecordConflictError'; }
}

const sameRecord = (left: CostRecord | RevenueRecord, right: CostRecord | RevenueRecord) =>
  Object.keys(left).every(key => left[key as keyof typeof left] === right[key as keyof typeof right]);

async function assertCapacity(database: AssetDatabase): Promise<void> {
  const count = await database.assets.count() + await database.costRecords.count() + await database.revenueRecords.count();
  if (count >= MAX_RECORDS) throw new Error(`本地数据库最多保存 ${MAX_RECORDS} 条资产和流水。`);
}

async function requireAsset(assetId: string, database: AssetDatabase) {
  const asset = await database.assets.get(assetId);
  if (!asset) throw new RecordConflictError('所属资产不存在或已删除。');
  return asset;
}

export async function createRecord(assetId: string, input: RecordInput, database: AssetDatabase = db, now = new Date()): Promise<RecordSnapshot> {
  const timestamp = now.toISOString();
  return database.transaction('rw', database.assets, database.costRecords, database.revenueRecords, async () => {
    const asset = await requireAsset(assetId, database); await assertCapacity(database);
    if (input.type === 'revenue') {
      const record = validateRevenueRecord({ id: crypto.randomUUID(), assetId, amountCents: parseYuan(input.amount), date: input.date, note: input.note, createdAt: timestamp, updatedAt: timestamp }, localToday(now), asset.purchaseDate);
      await database.revenueRecords.add(record); return { table: 'revenue', record };
    }
    const record = validateCostRecord({ id: crypto.randomUUID(), assetId, kind: input.type, amountCents: parseYuan(input.amount), date: input.date, note: input.note, createdAt: timestamp, updatedAt: timestamp }, localToday(now), asset.purchaseDate);
    await database.costRecords.add(record); return { table: 'cost', record };
  });
}

export async function getCostRecord(assetId: string, recordId: string, database: AssetDatabase = db): Promise<CostRecord | null> {
  const record = await database.costRecords.get(recordId); return record?.assetId === assetId ? record : null;
}
export async function getRevenueRecord(assetId: string, recordId: string, database: AssetDatabase = db): Promise<RevenueRecord | null> {
  const record = await database.revenueRecords.get(recordId); return record?.assetId === assetId ? record : null;
}

export async function updateCostRecord(assetId: string, expected: CostRecord, input: Omit<RecordInput, 'type'> & { type: CostKind }, database: AssetDatabase = db, now = new Date()): Promise<CostRecord> {
  return database.transaction('rw', database.assets, database.costRecords, async () => {
    const asset = await requireAsset(assetId, database); const current = await database.costRecords.get(expected.id);
    if (!current || current.assetId !== assetId) throw new RecordConflictError('流水不存在或已删除。');
    if (!sameRecord(current, expected)) throw new RecordConflictError();
    const updated = validateCostRecord({ ...current, kind: input.type, amountCents: parseYuan(input.amount), date: input.date, note: input.note, updatedAt: now.toISOString() }, localToday(now), asset.purchaseDate);
    await database.costRecords.put(updated); return updated;
  });
}

export async function updateRevenueRecord(assetId: string, expected: RevenueRecord, input: Omit<RecordInput, 'type'>, database: AssetDatabase = db, now = new Date()): Promise<RevenueRecord> {
  return database.transaction('rw', database.assets, database.revenueRecords, async () => {
    const asset = await requireAsset(assetId, database); const current = await database.revenueRecords.get(expected.id);
    if (!current || current.assetId !== assetId) throw new RecordConflictError('流水不存在或已删除。');
    if (!sameRecord(current, expected)) throw new RecordConflictError();
    const updated = validateRevenueRecord({ ...current, amountCents: parseYuan(input.amount), date: input.date, note: input.note, updatedAt: now.toISOString() }, localToday(now), asset.purchaseDate);
    await database.revenueRecords.put(updated); return updated;
  });
}

export async function deleteRecord(snapshot: RecordSnapshot, database: AssetDatabase = db): Promise<void> {
  const table = snapshot.table === 'cost' ? database.costRecords : database.revenueRecords;
  await database.transaction('rw', table, async () => {
    const current = await table.get(snapshot.record.id);
    if (!current || !sameRecord(current, snapshot.record)) throw new RecordConflictError('流水已变化或删除，请重新核对后再次确认。');
    await table.delete(snapshot.record.id);
  });
}
