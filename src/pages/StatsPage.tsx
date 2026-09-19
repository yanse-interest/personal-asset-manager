import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { AssetIcon } from '../components/AssetIcon';
import { getDashboardSnapshot } from '../data/queries';
import { categoryInsights, ledgerTotals, longestAssetSummaries, sortAssetSummaries, summarizeAssets, valueRankingCandidates } from '../domain/ledgers';
import { formatCents, formatRatio } from '../domain/money';
import { useToday } from '../hooks/useToday';

export function StatsPage() {
  const today = useToday();
  const result = useLiveQuery(async () => { try { return { snapshot: await getDashboardSnapshot(), error: null as string | null }; } catch { return { snapshot: null, error: '无法读取统计，请刷新后重试。' }; } });
  if (result === undefined) return <section className="loading-state"><p>正在加载统计…</p></section>;
  if (result.error || !result.snapshot) return <section><h1>使用统计</h1><p role="alert">{result.error}</p></section>;

  const summaries = summarizeAssets(result.snapshot, today);
  const totals = ledgerTotals(summaries);
  const active = summaries.filter(item => item.asset.lifecycleStatus === 'active').length;
  const retired = summaries.filter(item => item.asset.lifecycleStatus === 'retired').length;
  const sold = summaries.filter(item => item.asset.lifecycleStatus === 'sold').length;
  const activeRatio = summaries.length ? Math.round(active / summaries.length * 1000) / 10 : 0;
  const averageDays = summaries.length ? Math.round(summaries.reduce((sum, item) => sum + item.values.serviceDays, 0) / summaries.length) : 0;
  const totalServiceDays = summaries.reduce((sum, item) => sum + item.values.serviceDays, 0);
  const purchaseTotal = summaries.reduce((sum, item) => sum + item.values.purchaseCostCents, 0);
  const dayItems = summaries.filter(item => item.asset.costMode === 'day');
  const useItems = summaries.filter(item => item.asset.costMode === 'use');
  const totalUsage = useItems.reduce((sum, item) => sum + item.asset.usageCount, 0);
  const mostUsed = [...useItems].sort((left, right) => right.asset.usageCount - left.asset.usageCount || left.asset.id.localeCompare(right.asset.id))[0];
  const valueCandidates = valueRankingCandidates(summaries);
  const bestDay = sortAssetSummaries(valueCandidates, 'day-asc')[0];
  const bestUse = sortAssetSummaries(valueCandidates, 'use-asc').find(item => item.values.costPerUse !== null);
  const longest = longestAssetSummaries(summaries, 5);
  const categories = categoryInsights(result.snapshot.categories, summaries);
  const maxCategoryCount = Math.max(1, ...categories.map(category => category.count));

  return <section className="main-subpage stats-page">
    <div className="main-page-heading"><div><h1>使用统计</h1><p>陪伴、投入和使用方式一目了然</p></div><small>截至今天</small></div>

    <div className="stats-hero"><small>仍在日常使用</small><div><strong>{active} / {summaries.length}</strong><span>件 · {activeRatio}%</span></div><div className="status-bar"><i style={{ width: `${summaries.length ? active / summaries.length * 100 : 0}%` }}/><i style={{ width: `${summaries.length ? retired / summaries.length * 100 : 0}%` }}/><i style={{ width: `${summaries.length ? sold / summaries.length * 100 : 0}%` }}/></div><div className="stats-legend"><div><small>服役中</small><strong>{active} 件</strong></div><div><small>已退役</small><strong>{retired} 件</strong></div><div><small>已卖出</small><strong>{sold} 件</strong></div></div></div>

    <div className="stats-card"><h2>投入概览</h2><div className="stats-metric-grid"><div><small>累计购置</small><strong>{formatCents(purchaseTotal)}</strong></div><div><small>全部投入</small><strong>{formatCents(totals.totalCostCents)}</strong></div><div><small>累计收益</small><strong>{formatCents(totals.revenueCents)}</strong></div><div><small>当前净投入</small><strong>{formatCents(totals.netCostCents)}</strong></div></div></div>

    <div className="stats-card"><h2>陪伴与使用</h2><div className="stats-metric-grid"><div><small>平均陪伴</small><strong>{averageDays.toLocaleString('zh-CN')} 天</strong></div><div><small>累计陪伴</small><strong>{totalServiceDays.toLocaleString('zh-CN')} 天</strong></div><div><small>按日观察</small><strong>{dayItems.length} 件</strong></div><div><small>按次观察</small><strong>{useItems.length} 件</strong></div></div>{useItems.length > 0 && <p className="stats-note">按次好物累计记录 {totalUsage.toLocaleString('zh-CN')} 次{mostUsed && mostUsed.asset.usageCount > 0 ? `；使用最多的是“${mostUsed.asset.name}”，共 ${mostUsed.asset.usageCount.toLocaleString('zh-CN')} 次。` : '。'}</p>}</div>

    <div className="stats-card"><h2>当前低成本代表</h2>{!bestDay && !bestUse ? <p>还没有可比较的成本数据。</p> : <div className="value-leaders">{bestDay && <Link to="/?sort=day-asc"><span><AssetIcon id={bestDay.asset.iconId} name={bestDay.asset.name} categoryName={bestDay.category?.name} size={30}/></span><div><small>日均最低</small><strong>{bestDay.asset.name}</strong></div><b>{formatRatio(bestDay.values.costPerDay.numeratorCents, bestDay.values.costPerDay.denominator)} / 天</b></Link>}{bestUse?.values.costPerUse && <Link to="/?sort=use-asc"><span><AssetIcon id={bestUse.asset.iconId} name={bestUse.asset.name} categoryName={bestUse.category?.name} size={30}/></span><div><small>次均最低</small><strong>{bestUse.asset.name}</strong></div><b>{formatRatio(bestUse.values.costPerUse.numeratorCents, bestUse.values.costPerUse.denominator)} / 次</b></Link>}</div>}<small className="stats-rule">当天购入并退役或卖出的好物不参与评选。</small></div>

    <div className="stats-card"><h2>陪伴最久</h2>{longest.length === 0 ? <p>还没有好物数据。</p> : <div className="ranking-list">{longest.map((item, index) => <div className="ranking-row" key={item.asset.id}><span><AssetIcon id={item.asset.iconId} name={item.asset.name} categoryName={item.category?.name} size={30}/></span><div><strong>{index + 1}. {item.asset.name}</strong><small>{item.category?.name ?? '未分类'} · {item.asset.lifecycleStatus === 'active' ? '仍在使用' : item.asset.lifecycleStatus === 'retired' ? '已退役' : '已卖出'}</small></div><b>{item.values.serviceDays.toLocaleString('zh-CN')} 天</b></div>)}</div>}</div>

    <div className="stats-card"><h2>分类分布</h2>{categories.length === 0 ? <p>还没有分类数据。</p> : <div className="distribution-list">{categories.map(category => <div className="distribution-row" key={category.id}><span>{category.name}</span><div><i style={{ width: `${category.count / maxCategoryCount * 100}%` }}/></div><strong>{category.count}</strong></div>)}</div>}</div>

    <div className="stats-card"><h2>分类洞察</h2>{categories.length === 0 ? <p>还没有分类数据。</p> : <div className="category-insights">{categories.map(category => <Link key={category.id} to={`/categories/${category.id}`}><div className="category-insight-heading"><strong>{category.name}</strong><span>{category.count} 件 · {category.activeCount} 件使用中</span></div><dl><dt>陪伴最久</dt><dd>{category.longest.asset.name} · {category.longest.values.serviceDays.toLocaleString('zh-CN')} 天</dd><dt>累计投入</dt><dd>{formatCents(category.totals.totalCostCents)}</dd><dt>净投入</dt><dd>{formatCents(category.totals.netCostCents)}</dd></dl></Link>)}</div>}</div>
  </section>;
}
