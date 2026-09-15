import { useEffect, useState } from 'react';
import { usePwa } from './register';
import { hasPendingWork, UPDATE_BLOCKED_MESSAGE } from './updateGuard';

export function UpdatePrompt() {
  const { offlineReady, needRefresh, error, update } = usePwa();
  const [dismissedReady, setDismissedReady] = useState(false);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [dismissedError, setDismissedError] = useState(false);

  useEffect(() => { if (!needRefresh) setDismissedUpdate(false); }, [needRefresh]);

  async function acceptUpdate() {
    if (hasPendingWork()) {
      setMessage(UPDATE_BLOCKED_MESSAGE);
      return;
    }
    setMessage(null); setUpdating(true);
    try { await update(); }
    finally { setUpdating(false); }
  }
  if (needRefresh && !dismissedUpdate) return <aside className="pwa-prompt" role="status">
    <p>有新版本可用。请先保存未提交的内容，并关闭其他编辑标签。</p>
    {message && <p className="notice">{message}</p>}
    {error && <p role="alert">{error}</p>}
    <div className="button-row"><button className="primary" type="button" disabled={updating} onClick={acceptUpdate}>{updating ? '更新中…' : '保存后更新'}</button><button type="button" onClick={() => setDismissedUpdate(true)}>稍后</button></div>
  </aside>;
  if (error && !dismissedError) return <aside className="pwa-prompt" role="alert"><p>{error}</p><button type="button" onClick={() => setDismissedError(true)}>关闭</button></aside>;
  if (offlineReady && !dismissedReady) return <aside className="pwa-prompt" role="status">
    <p>应用资源已缓存，可离线使用。业务数据仍需定期导出 JSON 备份。</p>
    <button type="button" onClick={() => setDismissedReady(true)}>知道了</button>
  </aside>;
  return null;
}
