import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import { AppIcon } from '../components/AppIcon';
import { AssetCard } from '../components/AssetCard';
import { getDashboardSnapshot } from '../data/queries';
import { sortedCategories, statusNames, summarizeAssets } from '../domain/ledgers';
import { formatCents } from '../domain/money';
import type { LifecycleStatus } from '../domain/types';
import { useToday } from '../hooks/useToday';

type StatusFilter = LifecycleStatus | 'all';

export function DashboardPage() {
  const today = useToday();
  const [categoryId, setCategoryId] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('active');
  const result = useLiveQuery(async () => {
    try { return { snapshot: await getDashboardSnapshot(), error: null as string | null }; }
    catch { return { snapshot: null, error: '无法读取好物，请刷新后重试。' }; }
  });
  if (result === undefined) return <section className="loading-state"><p>正在加载…</p></section>;
  if (result.error || !result.snapshot) return <section><h1>好物</h1><p role="alert">{result.error}</p><button onClick={() => window.location.reload()}>重试</button></section>;

  const { assets, categories } = result.snapshot;
  const summaries = summarizeAssets(result.snapshot, today);
  const activeCount = summaries.filter(item => item.asset.lifecycleStatus === 'active').length;
  const retiredCount = summaries.filter(item => item.asset.lifecycleStatus === 'retired').length;
  const soldCount = summaries.filter(item => item.asset.lifecycleStatus === 'sold').length;
  const longestDays = Math.max(0, ...summaries.map(item => item.values.serviceDays));
  const averageDays = summaries.length ? Math.round(summaries.reduce((sum, item) => sum + item.values.serviceDays, 0) / summaries.length) : 0;
  const purchaseTotal = summaries.reduce((sum, item) => sum + item.values.purchaseCostCents, 0);
  const activeRatio = summaries.length ? Math.round(activeCount / summaries.length * 1000) / 10 : 0;
  const categoryFiltered = summaries.filter(item => categoryId === 'all' || (categoryId === 'uncategorized' ? item.asset.categoryId === null : item.asset.categoryId === categoryId));
  const selected = categoryFiltered.filter(item => status === 'all' || item.asset.lifecycleStatus === status);
  const statusCount = (value: StatusFilter) => value === 'all' ? categoryFiltered.length : categoryFiltered.filter(item => item.asset.lifecycleStatus === value).length;
  const statusLabel = status === 'all' ? '全部状态' : statusNames[status];

  return <section className="dashboard-page">
    <span className="sr-only">好物总览 · 状态账本 · 类别账本</span>
    <nav className="category-tabs" aria-label="自定义分类账本">
      <button className={categoryId === 'all' ? 'active' : ''} onClick={() => setCategoryId('all')}>全部</button>
      {sortedCategories(categories).map(category => <button key={category.id} className={categoryId === category.id ? 'active' : ''} onClick={() => setCategoryId(category.id)}>{category.name} <span>{summaries.filter(item => item.asset.categoryId === category.id).length}</span></button>)}
      {summaries.some(item => item.asset.categoryId === null) && <button className={categoryId === 'uncategorized' ? 'active' : ''} onClick={() => setCategoryId('uncategorized')}>未分类 <span>{summaries.filter(item => item.asset.categoryId === null).length}</span></button>}
      <Link to="/settings" aria-label="新建自定义类别">＋</Link>
    </nav>

    <div className="usage-overview">
      <div className="overview-top"><span>陪你过日子的好物</span><small>截至今天</small></div>
      <div className="overview-count"><strong>{summaries.length}</strong><span>件</span></div>
      <p>其中 {activeCount} 件仍在好好使用</p>
      <div className="overview-facts"><div><small>最久陪伴</small><strong>{longestDays.toLocaleString('zh-CN')} 天</strong></div><div><small>平均持有</small><strong>{averageDays.toLocaleString('zh-CN')} 天</strong></div><div><small>累计购置</small><strong>{formatCents(purchaseTotal)}</strong></div></div>
      <div className="active-progress"><div><span>仍在使用</span><strong>{activeRatio}%</strong></div><div className="progress-track"><i style={{ width: `${activeRatio}%` }}/></div></div>
      <div className="status-facts"><div><small>服役中</small><strong>{activeCount} 件</strong></div><div><small>已退役</small><strong>{retiredCount} 件</strong></div><div><small>已卖出</small><strong>{soldCount} 件</strong></div></div>
    </div>

    <div className="asset-section-heading"><h1>好物</h1><div><span>{selected.length} 件</span><label className="status-select"><AppIcon name="filter" size={17}/><select aria-label="状态筛选" value={status} onChange={event => setStatus(event.target.value as StatusFilter)}><option value="active">服役中（{statusCount('active')}）</option><option value="all">全部状态（{statusCount('all')}）</option><option value="retired">已退役（{statusCount('retired')}）</option><option value="sold">已卖出（{statusCount('sold')}）</option></select></label></div></div>
    {assets.length === 0 ? <div className="empty-state"><p>还没有记录好物。</p><div className="button-row"><Link className="button primary" to="/assets/new">记下第一件好物</Link><Link className="button" to="/settings">导入已有备份</Link></div></div> : selected.length === 0 ? <div className="empty-state"><p>“{statusLabel}”下暂时没有好物。</p><button onClick={() => setStatus('all')}>查看全部状态</button></div> : <ul className="asset-list">{selected.map(item => <li key={item.asset.id}><AssetCard asset={item.asset} category={item.category} costs={item.costs} revenues={item.revenues} today={today} /></li>)}</ul>}
  </section>;
}
