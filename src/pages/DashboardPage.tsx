import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { AssetCard } from '../components/AssetCard';
import { LedgerSummary } from '../components/LedgerSummary';
import { getDashboardSnapshot } from '../data/queries';
import { ledgerTotals, sortedCategories, statuses, statusNames, summarizeAssets } from '../domain/ledgers';
import { useToday } from '../hooks/useToday';

export function DashboardPage() {
  const today = useToday();
  const result = useLiveQuery(async () => {
    try { return { snapshot: await getDashboardSnapshot(), error: null as string | null }; }
    catch { return { snapshot: null, error: '无法读取资产，请刷新后重试。' }; }
  });
  if (result === undefined) return <section><h1>资产看板</h1><p>正在加载…</p></section>;
  if (result.error || !result.snapshot) return <section><h1>资产看板</h1><p role="alert">{result.error}</p><button onClick={() => window.location.reload()}>重试</button></section>;
  const { assets, categories } = result.snapshot;
  const summaries = summarizeAssets(result.snapshot, today);
  const countCategory = (id: string | null) => summaries.filter(item => item.asset.categoryId === id).length;
  return <section>
    <div className="page-heading"><h1>资产看板</h1><div className="button-row"><Link className="button" to="/settings">设置</Link><Link className="button primary" to="/assets/new">新增资产</Link></div></div>
    <LedgerSummary totals={ledgerTotals(summaries)} />
    <h2>状态账本</h2><nav className="ledger-links" aria-label="状态账本">{statuses.map(status => <Link key={status} to={`/ledgers/${status}`}><strong>{statusNames[status]}</strong><span>{summaries.filter(item => item.asset.lifecycleStatus === status).length} 件资产</span></Link>)}</nav>
    <h2>类别账本</h2><nav className="ledger-links" aria-label="类别账本">{sortedCategories(categories).map(category => <Link key={category.id} to={`/categories/${category.id}`}><strong>{category.name}</strong><span>{countCategory(category.id)} 件资产</span></Link>)}<Link to="/categories/uncategorized"><strong>未分类</strong><span>{countCategory(null)} 件资产</span></Link></nav>
    <h2>全部资产</h2>{assets.length === 0 ? <div className="empty-state"><p>还没有资产。</p><div className="button-row"><Link className="button primary" to="/assets/new">记录第一件大件资产</Link><Link className="button" to="/settings">导入已有备份</Link></div></div> : <ul className="asset-list">{summaries.map(item => <li key={item.asset.id}><AssetCard asset={item.asset} category={item.category} costs={item.costs} revenues={item.revenues} today={today} /></li>)}</ul>}
  </section>;
}
