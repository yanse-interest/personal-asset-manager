import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useBlocker, useNavigate } from 'react-router';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorMessage } from '../components/ErrorMessage';
import { exportBackup, getBackupCounts, readBackupFile, replaceFromBackup } from '../data/backup';
import type { BackupV1 } from '../domain/types';
import { usePwa } from '../pwa/register';

export function SettingsPage() {
  const navigate = useNavigate();
  const pwa = usePwa();
  const [pwaBusy, setPwaBusy] = useState(false);
  const counts = useLiveQuery(async () => {
    try { return { value: await getBackupCounts(), error: null as string | null }; }
    catch { return { value: null, error: '无法读取本地数据，请刷新后重试。' }; }
  });
  const [pending, setPending] = useState<BackupV1 | null>(null);
  const [filename, setFilename] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const importingRef = useRef(false);
  const blocker = useBlocker(() => importingRef.current);
  useEffect(() => {
    if (!importing) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [importing]);

  async function downloadBackup() {
    setExporting(true); setError(null); setExportMessage(null);
    try {
      const { json, filename: downloadName } = await exportBackup();
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
      try {
        const link = document.createElement('a');
        link.href = url; link.download = downloadName;
        document.body.append(link); link.click(); link.remove();
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
      setExportMessage(`已请求下载 ${downloadName}。请检查文件是否实际保存，并定期备份。`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '导出失败，请重试。'); }
    finally { setExporting(false); }
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || validating || importing) return;
    setPending(null); setConfirming(false); setError(null); setValidating(true);
    try { const parsed = await readBackupFile(file); setPending(parsed); setFilename(file.name); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '无法读取备份文件。'); }
    finally { setValidating(false); }
  }

  async function confirmImport() {
    if (!pending || importingRef.current) return;
    importingRef.current = true; setImporting(true); setError(null);
    try {
      await replaceFromBackup(pending);
      importingRef.current = false; setImporting(false);
      setPending(null); setConfirming(false);
      navigate('/', { replace: true });
    } catch (reason) {
      setConfirming(false);
      setError(reason instanceof Error ? reason.message : '导入失败，原数据未改变，请重试。');
    } finally { importingRef.current = false; setImporting(false); }
  }

  async function applyUpdate() {
    if (importing || validating) return;
    setPwaBusy(true);
    try { await pwa.update(); }
    finally { setPwaBusy(false); }
  }

  async function requestPersistence() {
    if (!navigator.storage?.persist) { setStorageMessage('当前浏览器不支持申请持久存储；仍需定期导出 JSON 备份。'); return; }
    try {
      const granted = await navigator.storage.persist();
      setStorageMessage(granted ? '浏览器已允许持久存储；这不能替代 JSON 备份。' : '浏览器未允许持久存储；数据目前仍保存在本机，请定期导出 JSON 备份。');
    } catch { setStorageMessage('无法申请持久存储；请检查浏览器存储设置，并定期导出 JSON 备份。'); }
  }

  return <section data-pwa-busy={importing || validating ? "true" : undefined}>
    <div className="page-heading"><h1>设置与数据</h1><Link className="button" to="/">返回首页</Link></div>
    <p>所有资产和流水只保存在当前浏览器的 IndexedDB。更换浏览器、地址或清除网站数据前，请导出 JSON 备份；备份文件是明文。</p>
    <h2>本地数据</h2>
    {counts === undefined ? <p>正在读取条数…</p> : counts.error || !counts.value ? <ErrorMessage>{counts.error ?? '无法读取本地数据。'}</ErrorMessage> : <dl><dt>资产</dt><dd>{counts.value.assets} 条</dd><dt>投入</dt><dd>{counts.value.costRecords} 条</dd><dt>收益</dt><dd>{counts.value.revenueRecords} 条</dd><dt>备份版本</dt><dd>v1 · CNY</dd></dl>}
    <h2>导出 JSON</h2><p>导出当前全部资产与流水。下载发起后，请到系统文件中确认文件实际存在。</p>
    <button className="primary" type="button" disabled={exporting || importing} onClick={downloadBackup}>{exporting ? '导出中…' : '导出全部数据'}</button>
    {exportMessage && <p role="status">{exportMessage}</p>}
    <h2>导入 JSON</h2><p>先校验文件，再预览并确认。导入将替换当前全部资产与流水，不合并数据。</p>
    <label className="backup-file-label">选择备份文件<input type="file" accept=".json,application/json" disabled={validating || importing} onChange={selectFile} /></label>
    {validating && <p role="status">正在验证备份…</p>}
    {pending && <div className="backup-preview"><h3>备份预览</h3><p>文件：{filename}</p><p>备份时间：{pending.exportedAt}</p><p>资产 {pending.assets.length} 条 · 投入 {pending.costRecords.length} 条 · 收益 {pending.revenueRecords.length} 条</p>{pending.assets.length + pending.costRecords.length + pending.revenueRecords.length === 0 && <p className="notice">这是空库备份，导入后将清空当前数据。</p>}<div className="button-row"><button className="primary" type="button" onClick={() => setConfirming(true)} disabled={importing}>覆盖当前数据…</button><button type="button" onClick={downloadBackup} disabled={exporting || importing}>先导出现有数据</button><button type="button" onClick={() => { setPending(null); setFilename(''); setError(null); }} disabled={importing}>取消导入</button></div></div>}
    {error && <ErrorMessage>{error}</ErrorMessage>}
    <h2>浏览器存储</h2><p>可申请浏览器尽量保留本站数据，但无论结果如何都应定期导出备份。</p><button type="button" onClick={requestPersistence} disabled={importing}>申请持久存储</button>{storageMessage && <p role="status">{storageMessage}</p>}
    <h2>PWA 状态</h2>
    {!window.isSecureContext ? <p role="status">当前环境不能启用 PWA 离线安装。请使用 HTTPS；桌面本机 localhost 可用于开发测试。</p> : !pwa.available ? <p role="status">当前浏览器或开发模式未启用离线缓存。请使用生产构建和支持 Service Worker 的浏览器。</p> : <>
      <p role="status">{pwa.offlineReady ? '应用资源已缓存，可离线打开；业务数据仍需 JSON 备份。' : '离线缓存尚未就绪。首次联网打开并等待缓存完成后才能离线使用。'}</p>
      {pwa.error && <ErrorMessage>{pwa.error}</ErrorMessage>}
      {pwa.installed ? <p>当前已以独立应用窗口打开。</p> : pwa.installAvailable ? <button type="button" onClick={() => void pwa.install()}>安装到设备</button> : <p>若浏览器没有显示安装按钮，请在 Android Chrome 菜单中选择“安装应用”或“添加到主屏幕”；首次安装需要可访问的安全来源。</p>}
      {pwa.needRefresh && <div><p>有新版本可用。请先保存编辑内容，并关闭其他编辑标签。</p><button type="button" disabled={pwaBusy || importing || validating} onClick={applyUpdate}>{pwaBusy ? '更新中…' : '保存后刷新更新'}</button></div>}
    </>}
    {confirming && pending && <ConfirmDialog title="覆盖全部本地数据？" confirmLabel="确认替换" busy={importing} onCancel={() => setConfirming(false)} onConfirm={confirmImport}><p>导入将替换当前全部资产和流水，其他标签刚写入的数据也可能被覆盖。建议先导出当前数据并关闭其他标签。</p>{pending.assets.length + pending.costRecords.length + pending.revenueRecords.length === 0 && <p className="notice">此备份为空，确认后将清空当前全部数据。</p>}</ConfirmDialog>}
    {blocker.state === 'blocked' && <ConfirmDialog title="正在导入" confirmLabel="留在此页" onCancel={() => blocker.reset()} onConfirm={() => blocker.reset()}><p>请等待导入事务完成后再离开。</p></ConfirmDialog>}
  </section>;
}
