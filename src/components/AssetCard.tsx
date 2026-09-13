import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { incrementUsage } from '../data/assets';
import { calculateAssetCosts } from '../domain/calculations';
import { expiryStatus } from '../domain/dates';
import { formatCents, formatRatio } from '../domain/money';
import type { Asset, CostRecord, RevenueRecord } from '../domain/types';
import { MAX_USAGE_COUNT } from '../domain/validation';

function expiryText(date: string | null, today: string): string {
  const status = expiryStatus(date, today);
  if (status.kind === 'none') return '未设置到期日';
  if (status.kind === 'today') return '今日到期';
  return status.kind === 'future' ? `距到期 ${status.days} 天` : `已到期 ${status.days} 天`;
}

export function AssetCard({ asset, costs, revenues, today }: { asset: Asset; costs: CostRecord[]; revenues: RevenueRecord[]; today: string }) {
  const values = calculateAssetCosts(asset, costs, revenues, today);
  const [incrementing, setIncrementing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const clearFeedbackTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (clearFeedbackTimer.current !== null) window.clearTimeout(clearFeedbackTimer.current);
  }, []);
  const primary = asset.costMode === 'day'
    ? `${formatRatio(values.costPerDay.numeratorCents, values.costPerDay.denominator)} / 天`
    : values.costPerUse ? `${formatRatio(values.costPerUse.numeratorCents, values.costPerUse.denominator)} / 次` : '— / 暂无使用记录';
  const atUsageLimit = asset.usageCount >= MAX_USAGE_COUNT;

  async function handleIncrement() {
    setIncrementing(true);
    setFeedback(null);
    try {
      await incrementUsage(asset.id);
      setFeedback('已记录 1 次');
      clearFeedbackTimer.current = window.setTimeout(() => setFeedback(null), 2500);
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : '记录失败，请重试。');
    } finally {
      setIncrementing(false);
    }
  }

  return <article className="asset-card">
    <Link className="asset-card-link" to={`/assets/${asset.id}`}>
      <span className="asset-card-heading"><strong>{asset.name}</strong><small>{asset.purchaseDate}</small></span>
      <span className="primary-metric">{primary}</span>
      <small>净投入 {formatCents(values.netCostCents)} · {asset.costMode === 'day' ? `持有 ${values.daysOwned} 天` : `累计 ${asset.usageCount} 次`}</small>
      <small>{expiryText(asset.expiryDate, today)}</small>
      {values.netCostCents < 0 && <small className="notice">收益已超过投入</small>}
      {values.clockBeforePurchase && <small className="notice">设备日期早于购买日期，持有天数暂按 1 天计算</small>}
    </Link>
    {asset.costMode === 'use' && <div className="usage-action">
      <button className="primary" type="button" disabled={incrementing || atUsageLimit} onClick={handleIncrement}>
        {incrementing ? '记录中…' : '+ 使用一次'}
      </button>
      <small aria-live="polite">{atUsageLimit ? '使用次数已达到上限' : feedback}</small>
    </div>}
  </article>;
}
