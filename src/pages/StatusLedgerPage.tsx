import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { AssetCard } from '../components/AssetCard';
import { LedgerSummary } from '../components/LedgerSummary';
import { getDashboardSnapshot } from '../data/queries';
import { ledgerTotals, sortedCategories, statusNames, summarizeAssets } from '../domain/ledgers';
import { useToday } from '../hooks/useToday';

export function StatusLedgerPage() {
  const { status } = useParams(); const [categoryId, setCategoryId] = useState('all'); const today = useToday();
  const result = useLiveQuery(async () => { try { return { snapshot: await getDashboardSnapshot(), error: null as string | null }; } catch { return { snapshot: null, error: '无法读取账本，请刷新后重试。' }; } });
  if (status !== 'active' && status !== 'retired' && status !== 'sold') return <section><h1>状态账本不存在</h1><Link to="/">返回总览</Link></section>;
  if (result === undefined) return <section><p>正在加载账本…</p></section>;
  if (result.error || !result.snapshot) return <section><h1>{statusNames[status]}</h1><p role="alert">{result.error}</p><button onClick={() => window.location.reload()}>重试</button></section>;
  const summaries = summarizeAssets(result.snapshot, today).filter(item => item.asset.lifecycleStatus === status);
  const selected = summaries.filter(item => categoryId === 'all' || (categoryId === 'uncategorized' ? item.asset.categoryId === null : item.asset.categoryId === categoryId));
  return <section><div className="page-heading"><h1>{statusNames[status]}账本</h1><Link className="button" to="/">返回总览</Link></div>
    <label>类别筛选<select value={categoryId} onChange={event => setCategoryId(event.target.value)}><option value="all">全部类别</option><option value="uncategorized">未分类</option>{sortedCategories(result.snapshot.categories).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    <LedgerSummary totals={ledgerTotals(selected)} />
    {selected.length === 0 ? <div className="empty-state"><p>此账本暂无资产。</p><div className="button-row"><Link className="button primary" to="/assets/new">新增资产</Link><Link className="button" to="/">返回总览</Link></div></div> : <ul className="asset-list">{selected.map(item => <li key={item.asset.id}><AssetCard asset={item.asset} category={item.category} costs={item.costs} revenues={item.revenues} today={today} /></li>)}</ul>}
  </section>;
}
