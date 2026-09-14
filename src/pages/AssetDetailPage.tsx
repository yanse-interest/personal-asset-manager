import { useLiveQuery } from 'dexie-react-hooks';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorMessage } from '../components/ErrorMessage';
import { correctUsageCount, deleteAsset, getAssetDeleteSnapshot, incrementUsage, type AssetDeleteSnapshot } from '../data/assets';
import { getAssetDetailSnapshot } from '../data/queries';
import { calculateAssetCosts } from '../domain/calculations';
import { expiryStatus } from '../domain/dates';
import { formatCents, formatRatio } from '../domain/money';
import type { CostRecord, RevenueRecord } from '../domain/types';
import { MAX_USAGE_COUNT } from '../domain/validation';
import { useToday } from '../hooks/useToday';

type DisplayRecord = { table: 'cost'; record: CostRecord } | { table: 'revenue'; record: RevenueRecord };
const label = (item: DisplayRecord) => item.table === 'revenue' ? '收益' : item.record.kind === 'additional' ? '后续本体投入' : '耗材投入';
function expiryText(date: string | null, today: string): string {
  const status = expiryStatus(date, today);
  if (status.kind === 'none') return '未设置到期日'; if (status.kind === 'today') return '今日到期';
  return status.kind === 'future' ? `距到期 ${status.days} 天` : `已到期 ${status.days} 天`;
}

export function AssetDetailPage() {
  const { assetId = '' } = useParams(); const navigate = useNavigate(); const today = useToday();
  const result = useLiveQuery(async () => {
    try { return { snapshot: await getAssetDetailSnapshot(assetId), error: null as string | null }; }
    catch { return { snapshot: null, error: '无法读取资产，请刷新后重试。' }; }
  }, [assetId]);
  const [deleteSnapshot, setDeleteSnapshot] = useState<AssetDeleteSnapshot | null>(null); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [incrementing, setIncrementing] = useState(false); const [usageFeedback, setUsageFeedback] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false); const [correctionValue, setCorrectionValue] = useState(''); const [correctionError, setCorrectionError] = useState<string | null>(null); const [correctionBusy, setCorrectionBusy] = useState(false);
  const clearFeedbackTimer = useRef<number | null>(null);
  useEffect(() => () => { if (clearFeedbackTimer.current !== null) window.clearTimeout(clearFeedbackTimer.current); }, []);
  if (result === undefined) return <section><p>正在加载…</p></section>;
  if (result.error) return <section><h1>资产详情</h1><ErrorMessage>{result.error}</ErrorMessage><button onClick={() => window.location.reload()}>重试</button></section>;
  if (!result.snapshot) return <section><h1>资产不存在或已删除</h1><Link to="/">返回首页</Link></section>;
  const { asset, category, costs, revenues } = result.snapshot; const values = calculateAssetCosts(asset, costs, revenues, today);
  const records: DisplayRecord[] = [...costs.map(record => ({ table: 'cost' as const, record })), ...revenues.map(record => ({ table: 'revenue' as const, record }))]
    .sort((a, b) => b.record.date.localeCompare(a.record.date) || b.record.createdAt.localeCompare(a.record.createdAt) || a.record.id.localeCompare(b.record.id));
  const dayMetric = `${formatRatio(values.costPerDay.numeratorCents, values.costPerDay.denominator)} / 天`;
  const useMetric = values.costPerUse ? `${formatRatio(values.costPerUse.numeratorCents, values.costPerUse.denominator)} / 次` : '— / 暂无使用记录';
  const atUsageLimit = asset.usageCount >= MAX_USAGE_COUNT;
  async function requestDelete() { setError(null); try { setDeleteSnapshot(await getAssetDeleteSnapshot(assetId)); } catch { setError('无法读取删除信息，请重试。'); } }
  async function confirmDelete() { if (!deleteSnapshot) return; setBusy(true); setError(null); try { await deleteAsset(deleteSnapshot); navigate('/', { replace: true }); } catch (reason) { setDeleteSnapshot(null); setError(reason instanceof Error ? reason.message : '删除失败，请重试。'); } finally { setBusy(false); } }
  async function handleIncrement() {
    setIncrementing(true); setUsageFeedback(null);
    try {
      await incrementUsage(asset.id);
      setUsageFeedback('已记录 1 次');
      clearFeedbackTimer.current = window.setTimeout(() => setUsageFeedback(null), 2500);
    } catch (reason) { setUsageFeedback(reason instanceof Error ? reason.message : '记录失败，请重试。'); }
    finally { setIncrementing(false); }
  }
  function openCorrection() { setCorrectionValue(String(asset.usageCount)); setCorrectionError(null); setCorrecting(true); }
  async function submitCorrection(event: FormEvent) {
    event.preventDefault(); setCorrectionBusy(true); setCorrectionError(null);
    try { await correctUsageCount(asset.id, asset.usageCount, correctionValue); setCorrecting(false); setUsageFeedback('使用次数已更正'); }
    catch (reason) { setCorrectionError(reason instanceof Error ? reason.message : '更正失败，请重试。'); }
    finally { setCorrectionBusy(false); }
  }
  return <section><div className="page-heading"><h1>{asset.name}</h1><Link className="button" to={`/assets/${asset.id}/edit`}>编辑</Link></div>
    <div className="hero-metric"><small>{asset.costMode === 'day' ? '日均成本' : '次均成本'}</small><strong>{asset.costMode === 'day' ? dayMetric : useMetric}</strong>{asset.costMode === 'use' && <span>累计 {asset.usageCount} 次 · 辅助日均 {dayMetric}</span>}<span>计费 {values.serviceDays} 天</span>
      {(asset.costMode === 'use' || asset.usageCount > 0) && <div className="usage-controls">{asset.lifecycleStatus === 'active' && asset.costMode === 'use' && <button className="primary" type="button" disabled={incrementing || atUsageLimit} onClick={handleIncrement}>{incrementing ? '记录中…' : '+ 使用一次'}</button>}<button type="button" disabled={incrementing || correctionBusy} onClick={openCorrection}>更正次数</button><small aria-live="polite">{atUsageLimit ? '使用次数已达到上限' : usageFeedback}</small></div>}
    </div>
    {correcting && <form className="usage-correction" onSubmit={submitCorrection} noValidate><label>累计使用次数<input autoFocus inputMode="numeric" value={correctionValue} onChange={event => setCorrectionValue(event.target.value)} aria-describedby={correctionError ? 'usage-correction-error' : undefined} /></label>{correctionError && <ErrorMessage id="usage-correction-error">{correctionError}</ErrorMessage>}<div className="button-row"><button className="primary" disabled={correctionBusy}>{correctionBusy ? '保存中…' : '保存更正'}</button><button type="button" disabled={correctionBusy} onClick={() => setCorrecting(false)}>取消</button></div></form>}
    {values.netCostCents < 0 && <p className="notice">收益已超过投入</p>}{values.clockBeforePurchase && <p className="notice">设备日期早于资产日期，请检查系统时钟；计费天数最低按 1 天显示。</p>}
    <h2>成本构成</h2><dl className="cost-summary"><dt>本体</dt><dd>{formatCents(values.purchaseCostCents)}</dd><dt>后续本体投入</dt><dd>{formatCents(values.additionalCostCents)}</dd><dt>耗材投入</dt><dd>{formatCents(values.consumableCostCents)}</dd><dt>总投入</dt><dd>{formatCents(values.totalCostCents)}</dd><dt>收益</dt><dd>{formatCents(values.revenueCents)}</dd><dt><strong>净投入</strong></dt><dd><strong>{formatCents(values.netCostCents)}</strong></dd></dl>
    <h2>资产信息</h2><dl><dt>类别</dt><dd>{category?.name ?? '未分类'}</dd><dt>状态</dt><dd>{asset.lifecycleStatus === 'active' ? '服役中' : asset.lifecycleStatus === 'retired' ? '已退役' : '已卖出'}</dd><dt>结束日期</dt><dd>{asset.endedDate ?? '未结束'}</dd><dt>购买日期</dt><dd>{asset.purchaseDate}</dd><dt>观察方式</dt><dd>{asset.costMode === 'day' ? '按天' : '按次'}</dd><dt>到期日期</dt><dd>{asset.expiryDate ?? '未设置'}</dd>{asset.lifecycleStatus === 'active' && <><dt>到期状态</dt><dd>{expiryText(asset.expiryDate, today)}</dd></>}{asset.note && <><dt>备注</dt><dd>{asset.note}</dd></>}</dl>
    {asset.lifecycleStatus === 'sold' && <p className="notice">卖价已按“出售”收益流水记录；旧版已卖出资产如尚未记录卖价，请手动补记。更正卖出状态不会自动删除已有收益。</p>}
    <h2>投入与收益</h2><div className="record-actions"><Link className="button" to={`/assets/${asset.id}/records/new?type=additional`}>添加本体投入</Link><Link className="button" to={`/assets/${asset.id}/records/new?type=consumable`}>添加耗材投入</Link><Link className="button" to={`/assets/${asset.id}/records/new?type=revenue`}>添加收益</Link></div>
    {records.length === 0 ? <p>暂无后续记录。</p> : <ul className="record-list">{records.map(item => <li key={item.record.id}><Link to={item.table === 'cost' ? `/assets/${asset.id}/costs/${item.record.id}/edit` : `/assets/${asset.id}/revenues/${item.record.id}/edit`}><span><strong>{label(item)}</strong><small>{item.record.date}{item.record.note ? ` · ${item.record.note}` : ''}</small></span><strong>{formatCents(item.record.amountCents)}</strong></Link></li>)}</ul>}
    {error && <ErrorMessage>{error}</ErrorMessage>}<div className="button-row"><Link className="button" to="/">返回首页</Link><button className="danger" onClick={requestDelete}>删除资产</button></div>
    {deleteSnapshot && <ConfirmDialog title="删除资产？" confirmLabel="删除资产" busy={busy} onCancel={() => setDeleteSnapshot(null)} onConfirm={confirmDelete}><p>“{deleteSnapshot.asset.name}”及其 {deleteSnapshot.costRecordIds.length} 条投入、{deleteSnapshot.revenueRecordIds.length} 条收益将永久删除，此操作不可撤销。</p></ConfirmDialog>}
  </section>;
}
