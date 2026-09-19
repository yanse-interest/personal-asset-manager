import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams, useSearchParams } from 'react-router';
import { readStatusFilter, updateListSearchParam } from '../app/listSearchParams';
import { AssetCard } from '../components/AssetCard';
import { LedgerSummary } from '../components/LedgerSummary';
import { getDashboardSnapshot } from '../data/queries';
import { ledgerTotals, statuses, statusNames, summarizeAssets } from '../domain/ledgers';
import { useToday } from '../hooks/useToday';

export function CategoryLedgerPage() {
  const { categoryId = '' } = useParams(); const [searchParams, setSearchParams] = useSearchParams(); const status = readStatusFilter(searchParams, 'all'); const today = useToday();
  const result = useLiveQuery(async () => { try { return { snapshot: await getDashboardSnapshot(), error: null as string | null }; } catch { return { snapshot: null, error: '无法读取账本，请刷新后重试。' }; } });
  if (result === undefined) return <section><p>正在加载账本…</p></section>;
  if (result.error || !result.snapshot) return <section><h1>类别账本</h1><p role="alert">{result.error}</p><button onClick={() => window.location.reload()}>重试</button></section>;
  const category = result.snapshot.categories.find(item => item.id === categoryId);
  if (categoryId !== 'uncategorized' && !category) return <section><h1>类别不存在或已删除</h1><Link to="/">返回总览</Link></section>;
  const summaries = summarizeAssets(result.snapshot, today).filter(item => item.asset.categoryId === (categoryId === 'uncategorized' ? null : categoryId));
  const selected = summaries.filter(item => status === 'all' || item.asset.lifecycleStatus === status);
  return <section><div className="page-heading"><h1>{category?.name ?? '未分类'}账本</h1><Link className="button" to="/">返回总览</Link></div>
    <p className="ledger-counts">{statuses.map(value => <span key={value}>{statusNames[value]} {summaries.filter(item => item.asset.lifecycleStatus === value).length} 件</span>)}</p>
    <label>状态筛选<select value={status} onChange={event => setSearchParams(updateListSearchParam(searchParams, 'status', event.target.value, 'all'), { replace: true, preventScrollReset: true })}><option value="all">全部状态</option>{statuses.map(value => <option key={value} value={value}>{statusNames[value]}</option>)}</select></label>
    <LedgerSummary totals={ledgerTotals(selected)} />
    {selected.length === 0 ? <div className="empty-state"><p>此账本暂无好物。</p><Link className="button" to="/">返回总览</Link></div> : <ul className="asset-list">{selected.map(item => <li key={item.asset.id}><AssetCard asset={item.asset} category={item.category} costs={item.costs} revenues={item.revenues} today={today} /></li>)}</ul>}
  </section>;
}
