import { daysOwned } from './dates';
import type { Asset, CostRecord, LocalDate, RevenueRecord } from './types';

export interface CostRatio { numeratorCents: number; denominator: number }
export interface AssetCosts {
  purchaseCostCents: number;
  additionalCostCents: number;
  consumableCostCents: number;
  totalCostCents: number;
  revenueCents: number;
  netCostCents: number;
  daysOwned: number;
  serviceDays: number;
  costPerDay: CostRatio;
  costPerUse: CostRatio | null;
  clockBeforePurchase: boolean;
}

function safeAdd(left: number, right: number): number {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || !Number.isSafeInteger(left + right)) {
    throw new Error('金额合计超出安全整数范围');
  }
  return left + right;
}

export function calculateAssetCosts(
  asset: Asset,
  costs: readonly CostRecord[],
  revenues: readonly RevenueRecord[],
  today: LocalDate,
): AssetCosts {
  let additionalCostCents = 0;
  let consumableCostCents = 0;
  let revenueCents = 0;
  for (const record of costs) {
    if (record.assetId !== asset.id) continue;
    if (record.kind === 'additional') additionalCostCents = safeAdd(additionalCostCents, record.amountCents);
    else if (record.kind === 'consumable') consumableCostCents = safeAdd(consumableCostCents, record.amountCents);
    else throw new Error('未知成本类型');
  }
  for (const record of revenues) {
    if (record.assetId === asset.id) revenueCents = safeAdd(revenueCents, record.amountCents);
  }
  const totalCostCents = safeAdd(safeAdd(asset.purchaseCostCents, additionalCostCents), consumableCostCents);
  const netCostCents = safeAdd(totalCostCents, -revenueCents);
  const serviceEnd = asset.lifecycleStatus === 'active' || asset.endedDate === null ? today : asset.endedDate;
  const owned = daysOwned(asset.purchaseDate, serviceEnd);
  return {
    purchaseCostCents: asset.purchaseCostCents,
    additionalCostCents,
    consumableCostCents,
    totalCostCents,
    revenueCents,
    netCostCents,
    daysOwned: owned,
    serviceDays: owned,
    costPerDay: { numeratorCents: netCostCents, denominator: owned },
    costPerUse: asset.usageCount > 0 ? { numeratorCents: netCostCents, denominator: asset.usageCount } : null,
    clockBeforePurchase: today < asset.purchaseDate || (asset.endedDate !== null && today < asset.endedDate),
  };
}
