import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { AssetCard } from '../components/AssetCard';
import { getDashboardSnapshot } from '../data/queries';
import { calculateAssetCosts } from '../domain/calculations';
import { formatCents } from '../domain/money';
import { useToday } from '../hooks/useToday';

function add(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error('金额合计超出安全整数范围');
  return result;
}

export function DashboardPage() {
  const today = useToday();
  const result = useLiveQuery(async () => {
    try { return { snapshot: await getDashboardSnapshot(), error: null as string | null }; }
    catch { return { snapshot: null, error: '无法读取资产，请刷新后重试。' }; }
  });
  if (result === undefined) return <section><h1>资产看板</h1><p>正在加载…</p></section>;
  if (result.error || !result.snapshot) return <section><h1>资产看板</h1><p role="alert">{result.error}</p><button onClick={() => window.location.reload()}>重试</button></section>;
  const { assets, costs, revenues } = result.snapshot;
  const costsByAsset = new Map<string, typeof costs>(); const revenuesByAsset = new Map<string, typeof revenues>();
  for (const record of costs) costsByAsset.set(record.assetId, [...(costsByAsset.get(record.assetId) ?? []), record]);
  for (const record of revenues) revenuesByAsset.set(record.assetId, [...(revenuesByAsset.get(record.assetId) ?? []), record]);
  const summaries = assets.map(asset => {
    const assetCosts = costsByAsset.get(asset.id) ?? []; const assetRevenues = revenuesByAsset.get(asset.id) ?? [];
    return { asset, costs: assetCosts, revenues: assetRevenues, values: calculateAssetCosts(asset, assetCosts, assetRevenues, today) };
  });
  const byAssetId = new Map(summaries.map(item => [item.asset.id, item]));
  const totals = summaries.reduce((sum, item) => ({ total: add(sum.total, item.values.totalCostCents), revenue: add(sum.revenue, item.values.revenueCents), net: add(sum.net, item.values.netCostCents) }), { total: 0, revenue: 0, net: 0 });
  return <section>
    <div className="page-heading"><h1>资产看板</h1><div className="button-row"><Link className="button" to="/settings">设置</Link><Link className="button primary" to="/assets/new">新增资产</Link></div></div>
    {assets.length === 0 ? <div className="empty-state"><p>还没有资产。</p><div className="button-row"><Link className="button primary" to="/assets/new">记录第一件大件资产</Link><Link className="button" to="/settings">导入已有备份</Link></div></div> : <>
      <div className="dashboard-summary"><div><small>资产</small><strong>{assets.length}</strong></div><div><small>总投入</small><strong>{formatCents(totals.total)}</strong></div><div><small>总收益</small><strong>{formatCents(totals.revenue)}</strong></div><div><small>净投入</small><strong>{formatCents(totals.net)}</strong></div></div>
      <ul className="asset-list">{[...assets].sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate) || a.id.localeCompare(b.id)).map(asset => { const item = byAssetId.get(asset.id)!; return <li key={asset.id}><AssetCard asset={asset} costs={item.costs} revenues={item.revenues} today={today} /></li>; })}</ul>
    </>}
  </section>;
}
