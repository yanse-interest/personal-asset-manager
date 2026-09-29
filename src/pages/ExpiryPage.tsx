import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { AssetIcon } from '../components/AssetIcon';
import { listNavigationState } from '../app/listNavigation';
import { getDashboardSnapshot } from '../data/queries';
import { expiryStatus } from '../domain/dates';
import { groupUpcomingExpiries } from '../domain/discovery';
import { summarizeAssets, type AssetSummary } from '../domain/ledgers';
import { useToday } from '../hooks/useToday';

function ExpiryGroup({ title, items, today }: { title: string; items: AssetSummary[]; today: string }) {
  if (items.length === 0) return null;
  return <section className="expiry-group"><h2>{title} <small>{items.length} 件</small></h2><ul className="expiry-list">
    {items.map(item => {
      const status = expiryStatus(item.asset.expiryDate, today);
      const label = status.kind === 'past' ? `已过期 ${status.days} 天` : status.kind === 'today' ? '今日到期' : status.kind === 'future' ? `还有 ${status.days} 天` : '';
      return <li key={item.asset.id}><Link to={`/assets/${item.asset.id}`} state={listNavigationState('/expiries', '')}>
        <span className="expiry-icon"><AssetIcon id={item.asset.iconId} name={item.asset.name} categoryName={item.category?.name} size={30} /></span>
        <span className="expiry-copy"><strong>{item.asset.name}</strong><small>{item.category?.name ?? '未分类'} · {item.asset.lifecycleStatus === 'pending' ? '待服役' : '服役中'} · {item.asset.expiryDate}</small></span>
        <span className="expiry-remaining">{label}</span>
      </Link></li>;
    })}
  </ul></section>;
}

export function ExpiryPage() {
  const today = useToday();
  const result = useLiveQuery(async () => {
    try { return { snapshot: await getDashboardSnapshot(), error: null as string | null }; }
    catch { return { snapshot: null, error: '无法读取到期清单，请刷新后重试。' }; }
  });
  if (result === undefined) return <section className="loading-state"><p>正在加载到期清单…</p></section>;
  if (result.error || !result.snapshot) return <section><h1>到期清单</h1><p role="alert">{result.error}</p><button onClick={() => window.location.reload()}>重试</button></section>;

  const groups = groupUpcomingExpiries(summarizeAssets(result.snapshot, today), today);
  const count = groups.overdue.length + groups.today.length + groups.soon.length + groups.later.length;
  return <section className="main-subpage expiry-page">
    <div className="page-heading"><h1>到期清单</h1><Link className="button" to="/">返回首页</Link></div>
    <p className="expiry-intro">显示服役中和待服役好物的到期日期；到期不会自动停止使用或成本计算。</p>
    {count === 0 ? <div className="empty-state"><p>目前没有需要关注的到期日期。</p><Link className="button" to="/">返回好物</Link></div> : <>
      <ExpiryGroup title="已过期" items={groups.overdue} today={today} />
      <ExpiryGroup title="今日到期" items={groups.today} today={today} />
      <ExpiryGroup title="未来 30 天" items={groups.soon} today={today} />
      <ExpiryGroup title="更晚到期" items={groups.later} today={today} />
    </>}
  </section>;
}
