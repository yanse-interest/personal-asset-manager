import { describe, expect, it } from 'vitest';
import { calculateAssetCosts } from './calculations';
import { calendarOrdinal, daysOwned, expiryStatus, isLocalDate } from './dates';
import { formatCents, formatRatio, parseYuan, roundRatioCents } from './money';
import { validateAsset, validateCostRecord, validateRevenueRecord } from './validation';
import type { Asset, CostRecord, RevenueRecord } from './types';

const id = '123e4567-e89b-42d3-a456-426614174000';
const costId = '123e4567-e89b-42d3-a456-426614174001';
const revenueId = '123e4567-e89b-42d3-a456-426614174002';
const timestamp = '2026-09-13T00:00:00.000Z';

const asset: Asset = {
  id, name: '咖啡机', purchaseCostCents: 100_000, purchaseDate: '2026-09-13',
  costMode: 'use', usageCount: 4, expiryDate: null, note: null,
  createdAt: timestamp, updatedAt: timestamp,
};
const costs: CostRecord[] = [
  { id: costId, assetId: id, kind: 'additional', amountCents: 20_000, date: '2026-09-13', note: null, createdAt: timestamp, updatedAt: timestamp },
  { id: '123e4567-e89b-42d3-a456-426614174003', assetId: id, kind: 'consumable', amountCents: 30_000, date: '2026-09-13', note: null, createdAt: timestamp, updatedAt: timestamp },
];
const revenues: RevenueRecord[] = [
  { id: revenueId, assetId: id, amountCents: 10_000, date: '2026-09-13', note: null, createdAt: timestamp, updatedAt: timestamp },
];

describe('money', () => {
  it('parses decimal text without floating-point multiplication', () => {
    expect(parseYuan(' 0.01 ')).toBe(1);
    expect(parseYuan('0.1')).toBe(10);
    expect(parseYuan('999999999.99')).toBe(99_999_999_999);
    expect(parseYuan('0', true)).toBe(0);
    for (const input of ['', '1.005', '1e3', '01', '-1', '1,000', '¥1', '1000000000', '0']) {
      expect(() => parseYuan(input)).toThrow();
    }
    expect(() => parseYuan('1000000000', true)).toThrow();
  });

  it('rounds positive and negative ratios only for display', () => {
    expect(formatRatio(100, 3)).toBe('¥0.33');
    expect(formatRatio(1, 2)).toBe('¥0.01');
    expect(formatRatio(-1, 2)).toBe('-¥0.01');
    expect(formatRatio(-1, 3)).toBe('¥0.00');
    expect(formatCents(-50)).toBe('-¥0.50');
    expect(() => roundRatioCents(10, 0)).toThrow();
    expect(() => formatCents(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
});

describe('dates', () => {
  it('validates real Gregorian dates and counts inclusive calendar days', () => {
    expect(isLocalDate('2024-02-29')).toBe(true);
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2026-13-01')).toBe(false);
    expect(isLocalDate('1899-12-31')).toBe(false);
    expect(daysOwned('2026-09-13', '2026-09-13')).toBe(1);
    expect(daysOwned('2026-09-13', '2026-09-14')).toBe(2);
    expect(daysOwned('2026-09-14', '2026-09-13')).toBe(1);
    expect(calendarOrdinal('2024-03-11') - calendarOrdinal('2024-03-09')).toBe(2);
  });

  it('returns precise expiry states', () => {
    expect(expiryStatus(null, '2026-09-13')).toEqual({ kind: 'none' });
    expect(expiryStatus('2026-09-15', '2026-09-13')).toEqual({ kind: 'future', days: 2 });
    expect(expiryStatus('2026-09-15', '2026-09-15')).toEqual({ kind: 'today' });
    expect(expiryStatus('2026-09-15', '2026-09-16')).toEqual({ kind: 'past', days: 1 });
  });
});

describe('cost calculations', () => {
  it('uses the four fixed categories and raw ratios', () => {
    const result = calculateAssetCosts(asset, costs, revenues, '2026-09-13');
    expect(result).toMatchObject({ purchaseCostCents: 100_000, additionalCostCents: 20_000, consumableCostCents: 30_000, totalCostCents: 150_000, revenueCents: 10_000, netCostCents: 140_000, daysOwned: 1, costPerDay: { numeratorCents: 140_000, denominator: 1 }, costPerUse: { numeratorCents: 140_000, denominator: 4 } });
    expect(formatRatio(result.costPerUse!.numeratorCents, result.costPerUse!.denominator)).toBe('¥350.00');
    expect(calculateAssetCosts(asset, costs, revenues, '2026-09-14').costPerDay.denominator).toBe(2);
  });

  it('handles zero use, excess revenue and clock rollback', () => {
    const result = calculateAssetCosts({ ...asset, usageCount: 0, purchaseCostCents: 0 }, [], [{ ...revenues[0]!, amountCents: 1 }], '2026-09-12');
    expect(result.netCostCents).toBe(-1);
    expect(result.costPerUse).toBeNull();
    expect(result.daysOwned).toBe(1);
    expect(result.clockBeforePurchase).toBe(true);
  });

  it('rejects unsafe sums', () => {
    expect(() => calculateAssetCosts({ ...asset, purchaseCostCents: Number.MAX_SAFE_INTEGER }, costs, [], '2026-09-13')).toThrow();
  });
});

describe('model validation', () => {
  it('normalizes allowed whitespace and rejects extra fields or wrong types', () => {
    expect(validateAsset({ ...asset, name: '  咖啡机  ', note: '  ' }, '2026-09-13')).toMatchObject({ name: '咖啡机', note: null });
    expect(() => validateAsset({ ...asset, extra: true }, '2026-09-13')).toThrow('asset.extra');
    expect(() => validateAsset({ ...asset, usageCount: 0.5 }, '2026-09-13')).toThrow('asset.usageCount');
    expect(() => validateAsset({ ...asset, purchaseDate: '2026-09-14' }, '2026-09-13')).toThrow('asset.purchaseDate');
    expect(() => validateAsset({ ...asset, expiryDate: '2026-09-12' }, '2026-09-13')).toThrow('asset.expiryDate');
    expect(() => validateAsset({ ...asset, note: '\ud800' }, '2026-09-13')).toThrow('asset.note');
    expect(() => validateAsset({ ...asset, name: '字'.repeat(101) }, '2026-09-13')).toThrow('asset.name');
  });

  it('validates both record types against purchase date', () => {
    expect(validateCostRecord(costs[0], '2026-09-13', '2026-09-13')).toEqual(costs[0]);
    expect(validateRevenueRecord(revenues[0], '2026-09-13', '2026-09-13')).toEqual(revenues[0]);
    expect(() => validateCostRecord({ ...costs[0], date: '2026-09-12' }, '2026-09-13', '2026-09-13')).toThrow('costRecord.date');
    expect(() => validateCostRecord({ ...costs[0], amountCents: 0 }, '2026-09-13', '2026-09-13')).toThrow('costRecord.amountCents');
    expect(() => validateRevenueRecord({ ...revenues[0], amountCents: '100' }, '2026-09-13', '2026-09-13')).toThrow('revenueRecord.amountCents');
  });
});
