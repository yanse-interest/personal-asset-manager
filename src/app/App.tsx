import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { db, subscribeDatabaseIssues, type DatabaseIssue } from '../data/db';
import { PwaProvider } from '../pwa/register';
import { UpdatePrompt } from '../pwa/UpdatePrompt';
import { BottomNav } from '../components/BottomNav';
import { AppIcon } from '../components/AppIcon';

export function App() {
  const location = useLocation();
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [databaseReady, setDatabaseReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeDatabaseIssues((issue: DatabaseIssue) => {
      setDatabaseError(issue === 'blocked' ? '数据库升级被其他标签阻止，请关闭其他标签后重试。' : '数据库版本已变化，请刷新页面。');
    });
    void db.open().then(() => {
      if (mounted) { setDatabaseReady(true); setDatabaseError(null); }
    }).catch(() => { if (mounted) setDatabaseError('无法打开本地数据库，请检查浏览器存储权限后刷新重试。'); });
    return () => { mounted = false; unsubscribe(); };
  }, []);
  const mainRoute = ['/', '/categories', '/stats', '/settings'].includes(location.pathname);
  return (
    <PwaProvider><main className="app-shell">
      <header className="app-header">
        <Link className="brand" to="/"><img src={`${import.meta.env.BASE_URL}icon.svg`} width="37" height="37" alt=""/><span><strong>久用</strong><small>把日常的陪伴记下来</small></span></Link>
        {location.pathname !== '/settings' && <Link className="header-action" to="/settings" aria-label="打开设置"><AppIcon name="settings" /></Link>}
      </header>
      {databaseError && <div role="alert"><p>{databaseError}</p><button type="button" onClick={() => window.location.reload()}>刷新重试</button></div>}
      <div className="page-content">{databaseReady ? <Outlet /> : !databaseError && <p role="status">正在打开本地数据…</p>}</div>
      {mainRoute && <BottomNav />}
      <UpdatePrompt />
    </main></PwaProvider>
  );
}
