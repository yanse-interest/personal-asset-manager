import { Link } from 'react-router';

export function AppErrorPage() {
  return <section className="app-shell" role="alert">
    <h1>这个页面暂时无法显示</h1>
    <p>可以返回首页重试，或到设置页导出备份。请不要通过清除网站数据排查。</p>
    <div className="button-row">
      <Link className="button" to="/">返回首页</Link>
      <Link className="button" to="/settings">设置与备份</Link>
      <button type="button" onClick={() => window.location.reload()}>重新加载</button>
    </div>
  </section>;
}
