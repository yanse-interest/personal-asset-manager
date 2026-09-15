import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { AppIcon } from '../components/AppIcon';
import { AssetIcon } from '../components/AssetIcon';
import { getDashboardSnapshot } from '../data/queries';
import { sortedCategories, summarizeAssets } from '../domain/ledgers';
import { useToday } from '../hooks/useToday';

export function CategoriesPage() {
  const today = useToday();
  const result = useLiveQuery(async () => { try { return { snapshot: await getDashboardSnapshot(), error: null as string | null }; } catch { return { snapshot: null, error: '无法读取分类，请刷新后重试。' }; } });
  if (result === undefined) return <section className="loading-state"><p>正在加载分类…</p></section>;
  if (result.error || !result.snapshot) return <section><h1>分类</h1><p role="alert">{result.error}</p></section>;
  const summaries = summarizeAssets(result.snapshot, today);
  const rows = sortedCategories(result.snapshot.categories).map(category => ({ id: category.id, name: category.name, items: summaries.filter(item => item.asset.categoryId === category.id) }));
  const uncategorized = summaries.filter(item => item.asset.categoryId === null);
  return <section className="main-subpage">
    <div className="main-page-heading"><div><h1>分类</h1><p>按你自己的生活场景整理</p></div><Link className="text-action" to="/settings">管理</Link></div>
    <div className="category-list">
      {rows.map(row => <Link className="category-row" key={row.id} to={`/categories/${row.id}`}><span className="category-icon"><AssetIcon id={row.items[0]?.asset.iconId} name={row.items[0]?.asset.name ?? row.name} categoryName={row.name} size={32}/></span><span className="category-copy"><strong>{row.name}</strong><small>{row.items.filter(item => item.asset.lifecycleStatus === 'active').length} 件仍在使用</small></span><span className="category-tail"><strong>{row.items.length} 件</strong><AppIcon name="chevron" size={18}/></span></Link>)}
      {uncategorized.length > 0 && <Link className="category-row" to="/categories/uncategorized"><span className="category-icon">📦</span><span className="category-copy"><strong>未分类</strong><small>还没有放进自定义类别</small></span><span className="category-tail"><strong>{uncategorized.length} 件</strong><AppIcon name="chevron" size={18}/></span></Link>}
      {rows.length === 0 && uncategorized.length === 0 && <div className="empty-state"><p>还没有可以分类的好物。</p><Link className="button primary" to="/assets/new">记下一件好物</Link></div>}
    </div>
  </section>;
}
