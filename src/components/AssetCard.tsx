import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { listNavigationState } from '../app/listNavigation';
import { incrementUsage } from '../data/assets';
import { calculateAssetCosts } from '../domain/calculations';
import { formatCents, formatRatio } from '../domain/money';
import type { Asset, Category, CostRecord, RevenueRecord } from '../domain/types';
import { MAX_USAGE_COUNT } from '../domain/validation';
import { AssetIcon } from './AssetIcon';

const statusLabel = { active: '服役中', retired: '已退役', sold: '已卖出' };
export function AssetCard({ asset, category, costs, revenues, today }: { asset: Asset; category?: Category | null; costs: CostRecord[]; revenues: RevenueRecord[]; today: string }) {
  const location = useLocation();
  const navigationState = listNavigationState(location.pathname, location.search);
  const values = calculateAssetCosts(asset, costs, revenues, today);
  const [incrementing, setIncrementing] = useState(false);
  const incrementWriting = useRef(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const clearFeedbackTimer = useRef<number | null>(null);
  useEffect(() => () => { if (clearFeedbackTimer.current !== null) window.clearTimeout(clearFeedbackTimer.current); }, []);
  const primary = asset.costMode === 'day' ? `${formatRatio(values.costPerDay.numeratorCents, values.costPerDay.denominator)} / 天` : values.costPerUse ? `${formatRatio(values.costPerUse.numeratorCents, values.costPerUse.denominator)} / 次` : '— / 暂无记录';
  const atUsageLimit = asset.usageCount >= MAX_USAGE_COUNT;
  async function handleIncrement() {
    if (incrementWriting.current) return;
    incrementWriting.current = true;
    setIncrementing(true); setFeedback(null);
    try { await incrementUsage(asset.id); setFeedback('已记录 1 次'); if (clearFeedbackTimer.current !== null) window.clearTimeout(clearFeedbackTimer.current); clearFeedbackTimer.current = window.setTimeout(() => setFeedback(null), 2500); }
    catch (reason) { setFeedback(reason instanceof Error ? reason.message : '记录失败，请重试。'); }
    finally { incrementWriting.current = false; setIncrementing(false); }
  }
  return <article className="asset-card" data-pwa-busy={incrementing ? 'true' : undefined}>
    <Link className="asset-visual" to={`/assets/${asset.id}`} state={navigationState} aria-label={`查看 ${asset.name}`}><AssetIcon id={asset.iconId} name={asset.name} categoryName={category?.name} size={52}/></Link>
    <Link className="asset-card-link" to={`/assets/${asset.id}`} state={navigationState}>
      <strong className="asset-name">{asset.name}</strong>
      <span className={`asset-status ${asset.lifecycleStatus}`}>{statusLabel[asset.lifecycleStatus]}</span>
      <small className="asset-meta">购入 {formatCents(asset.purchaseCostCents)} · {asset.costMode === 'use' ? `累计 ${asset.usageCount.toLocaleString('zh-CN')} 次` : `${asset.lifecycleStatus === 'active' ? '已陪伴' : '共陪伴'} ${values.serviceDays.toLocaleString('zh-CN')} 天`}</small>
      <strong className="primary-metric">{primary}</strong>
    </Link>
    {asset.lifecycleStatus === 'active' && asset.costMode === 'use' && <div className="usage-action"><button type="button" disabled={incrementing || atUsageLimit} onClick={handleIncrement}>{incrementing ? '记录中…' : '+ 使用一次'}</button><small aria-live="polite">{atUsageLimit ? '次数已达上限' : feedback}</small></div>}
    {values.clockBeforePurchase && <small className="notice">设备日期早于好物日期</small>}
  </article>;
}
