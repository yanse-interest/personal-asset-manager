import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router';
import { db, subscribeDatabaseIssues, type DatabaseIssue } from '../data/db';
import { PwaProvider } from '../pwa/register';
import { UpdatePrompt } from '../pwa/UpdatePrompt';

export function App() {
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  useEffect(() => {
    const unsubscribe = subscribeDatabaseIssues((issue: DatabaseIssue) => {
      setDatabaseError(issue === 'blocked' ? '数据库升级被其他标签阻止，请关闭其他标签后重试。' : '数据库版本已变化，请刷新页面。');
    });
    void db.open().catch(() => setDatabaseError('无法打开本地数据库，请检查浏览器存储权限后刷新重试。'));
    return unsubscribe;
  }, []);
  return (
    <PwaProvider><main>
      <header>
        <Link to="/">大件资产成本</Link>
      </header>
      {databaseError && <p role="alert">{databaseError}</p>}
      <Outlet />
      <UpdatePrompt />
    </main></PwaProvider>
  );
}
