import { useLiveQuery } from 'dexie-react-hooks';
import { getDashboardSnapshot } from '../data/queries';
import { sortedCategories, summarizeAssets } from '../domain/ledgers';
import { AssetIcon } from '../components/AssetIcon';
import { useToday } from '../hooks/useToday';

export function StatsPage() {
  const today = useToday();
  const result = useLiveQuery(async () => { try { return { snapshot: await getDashboardSnapshot(), error: null as string | null }; } catch { return { snapshot: null, error: '无法读取统计，请刷新后重试。' }; } });
  if (result === undefined) return <section className="loading-state"><p>正在加载统计…</p></section>;
  if (result.error || !result.snapshot) return <section><h1>使用统计</h1><p role="alert">{result.error}</p></section>;
  const summaries = summarizeAssets(result.snapshot, today);
  const active = summaries.filter(item => item.asset.lifecycleStatus === 'active').length;
  const retired = summaries.filter(item => item.asset.lifecycleStatus === 'retired').length;
  const sold = summaries.filter(item => item.asset.lifecycleStatus === 'sold').length;
  const ratio = summaries.length ? Math.round(active / summaries.length * 1000) / 10 : 0;
  const longest = [...summaries].sort((a, b) => b.values.serviceDays - a.values.serviceDays).slice(0, 3);
  const categoryRows = sortedCategories(result.snapshot.categories).map(category => ({ name: category.name, count: summaries.filter(item => item.asset.categoryId === category.id).length })).filter(row => row.count > 0).sort((a, b) => b.count - a.count);
  const uncategorized = summaries.filter(item => item.asset.categoryId === null).length;
  if (uncategorized) categoryRows.push({ name: '未分类', count: uncategorized });
  categoryRows.sort((a, b) => b.count - a.count);
  const maxCategory = Math.max(1, ...categoryRows.map(row => row.count));
  return <section className="main-subpage stats-page">
    <div className="main-page-heading"><div><h1>使用统计</h1><p>看看哪些东西陪你最久</p></div><small>全部时间</small></div>
    <div className="stats-hero"><small>仍在日常使用</small><div><strong>{active} / {summaries.length}</strong><span>件 · {ratio}%</span></div><div className="status-bar"><i style={{ width: `${summaries.length ? active / summaries.length * 100 : 0}%` }}/><i style={{ width: `${summaries.length ? retired / summaries.length * 100 : 0}%` }}/><i style={{ width: `${summaries.length ? sold / summaries.length * 100 : 0}%` }}/></div><div className="stats-legend"><div><small>服役中</small><strong>{active} 件</strong></div><div><small>已退役</small><strong>{retired} 件</strong></div><div><small>已卖出</small><strong>{sold} 件</strong></div></div></div>
    <div className="stats-card"><h2>陪伴最久</h2>{longest.length === 0 ? <p>还没有好物数据。</p> : <div className="ranking-list">{longest.map(item => <div className="ranking-row" key={item.asset.id}><span><AssetIcon id={item.asset.iconId} name={item.asset.name} categoryName={item.category?.name} size={30}/></span><div><strong>{item.asset.name}</strong><small>{item.asset.lifecycleStatus === 'active' ? '仍在使用' : item.asset.lifecycleStatus === 'retired' ? '已退役' : '已卖出'}</small></div><b>{item.values.serviceDays.toLocaleString('zh-CN')} 天</b></div>)}</div>}</div>
    <div className="stats-card"><h2>分类分布</h2>{categoryRows.length === 0 ? <p>还没有好物数据。</p> : <div className="distribution-list">{categoryRows.map((row, index) => <div className="distribution-row" key={index}><span>{row.name}</span><div><i style={{ width: `${row.count / maxCategory * 100}%` }}/></div><strong>{row.count}</strong></div>)}</div>}</div>
  </section>;
}
