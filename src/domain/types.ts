export type LocalDate = string;
export type Instant = string;
export type CostMode = 'day' | 'use';
export type CostKind = 'additional' | 'consumable';

export interface Asset {
  id: string;
  name: string;
  purchaseCostCents: number;
  purchaseDate: LocalDate;
  costMode: CostMode;
  usageCount: number;
  expiryDate: LocalDate | null;
  note: string | null;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface CostRecord {
  id: string;
  assetId: string;
  kind: CostKind;
  amountCents: number;
  date: LocalDate;
  note: string | null;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface RevenueRecord {
  id: string;
  assetId: string;
  amountCents: number;
  date: LocalDate;
  note: string | null;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface BackupV1 {
  format: 'large-asset-cost-backup';
  schemaVersion: 1;
  exportedAt: Instant;
  currency: 'CNY';
  assets: Asset[];
  costRecords: CostRecord[];
  revenueRecords: RevenueRecord[];
}
