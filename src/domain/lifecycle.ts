import type { Asset, LocalDate } from './types';

/** Resolve expiry without rewriting the saved asset, so correcting its date can restore service. */
export function effectiveAsset(asset: Asset, today: LocalDate): Asset {
  if (asset.lifecycleStatus !== 'active' || asset.expiryDate === null || asset.expiryDate >= today
    || asset.serviceStartDate === null || asset.expiryDate < asset.serviceStartDate) return asset;
  return { ...asset, lifecycleStatus: 'retired', endedDate: asset.expiryDate };
}
