export type LocalDate = string;
export type Instant = string;
export type CostMode = 'day' | 'use';
export type CostKind = 'additional' | 'consumable';
export type LifecycleStatus = 'active' | 'retired' | 'sold';

export interface LegacyAssetV1 {
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

export interface AssetV2 extends LegacyAssetV1 {
  categoryId: string | null;
  lifecycleStatus: LifecycleStatus;
  endedDate: LocalDate | null;
}

export interface Asset extends AssetV2 {
  iconId: string | null;
}

export interface Category {
  id: string;
  name: string;
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
  assets: LegacyAssetV1[];
  costRecords: CostRecord[];
  revenueRecords: RevenueRecord[];
}


export interface BackupV2 {
  format: 'large-asset-cost-backup';
  schemaVersion: 2;
  exportedAt: Instant;
  currency: 'CNY';
  assets: AssetV2[];
  categories: Category[];
  costRecords: CostRecord[];
  revenueRecords: RevenueRecord[];
}

export interface BackupV3 extends Omit<BackupV2, 'schemaVersion' | 'assets'> {
  schemaVersion: 3;
  assets: Asset[];
}

export interface BackupImport extends BackupV3 {
  readonly sourceSchemaVersion: 1 | 2 | 3;
}
