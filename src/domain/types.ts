export type LocalDate = string;
export type Instant = string;
export type CostMode = 'day' | 'use';
export type CostKind = 'additional' | 'consumable';
export type LegacyLifecycleStatus = 'active' | 'retired' | 'sold';
export type LifecycleStatus = 'pending' | LegacyLifecycleStatus;

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
  lifecycleStatus: LegacyLifecycleStatus;
  endedDate: LocalDate | null;
}

export interface AssetV3 extends AssetV2 {
  iconId: string | null;
}

export interface AssetV4 extends AssetV3 {
  serviceStartDate: LocalDate;
}

export interface Asset extends Omit<AssetV4, 'lifecycleStatus' | 'serviceStartDate'> {
  lifecycleStatus: LifecycleStatus;
  serviceStartDate: LocalDate | null;
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

export interface RegularItem {
  id: string;
  name: string;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface RegularVariant {
  id: string;
  itemId: string;
  name: string;
  specification: string;
  platform: string;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface RegularPurchase {
  id: string;
  variantId: string;
  date: LocalDate;
  quantity: number;
  paidCents: number;
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
  assets: AssetV3[];
}

export interface BackupV4 extends Omit<BackupV3, 'schemaVersion' | 'assets'> {
  schemaVersion: 4;
  assets: AssetV4[];
}

export interface BackupV5 extends Omit<BackupV4, 'schemaVersion' | 'assets'> {
  schemaVersion: 5;
  assets: Asset[];
}

export interface BackupV6 extends Omit<BackupV5, 'schemaVersion'> {
  schemaVersion: 6;
  regularItems: RegularItem[];
  regularVariants: RegularVariant[];
  regularPurchases: RegularPurchase[];
}

export interface BackupImport extends BackupV6 {
  readonly sourceSchemaVersion: 1 | 2 | 3 | 4 | 5 | 6;
}
