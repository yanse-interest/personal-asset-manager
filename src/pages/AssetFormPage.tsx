import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import { createAsset, getAsset, updateAsset } from '../data/assets';
import { useLiveQuery } from 'dexie-react-hooks';
import { listCategories } from '../data/categories';
import { localToday } from '../domain/dates';
import { formatCents } from '../domain/money';
import type { Asset, CostMode, LifecycleStatus } from '../domain/types';
import { ErrorMessage } from '../components/ErrorMessage';

interface Draft { name: string; purchaseCost: string; purchaseDate: string; costMode: CostMode; initialUsageCount: string; expiryDate: string; note: string; categoryId: string; lifecycleStatus: LifecycleStatus; endedDate: string; salePrice: string }
const emptyDraft = (): Draft => ({ name: '', purchaseCost: '', purchaseDate: localToday(), costMode: 'day', initialUsageCount: '0', expiryDate: '', note: '', categoryId: '', lifecycleStatus: 'active', endedDate: '', salePrice: '' });

export function AssetFormPage() {
  const { assetId } = useParams(); const editing = Boolean(assetId); const navigate = useNavigate();
  const categoryResult = useLiveQuery(async () => {
    try { return { value: await listCategories(), error: null as string | null }; }
    catch { return { value: null, error: '无法读取类别，请刷新后重试。' }; }
  });
  const [source, setSource] = useState<Asset | null>(null); const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loaded, setLoaded] = useState(!editing); const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [dirty, setDirty] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!assetId) return; void getAsset(assetId).then(asset => {
    if (!asset) setMissing(true); else { setSource(asset); setDraft({ name: asset.name, purchaseCost: (asset.purchaseCostCents / 100).toFixed(2), purchaseDate: asset.purchaseDate, costMode: asset.costMode, initialUsageCount: String(asset.usageCount), expiryDate: asset.expiryDate ?? '', note: asset.note ?? '', categoryId: asset.categoryId ?? '', lifecycleStatus: asset.lifecycleStatus, endedDate: asset.endedDate ?? '', salePrice: '' }); }
    setLoaded(true);
  }).catch(() => { setError('无法读取资产，请刷新后重试。'); setLoaded(true); }); }, [assetId]);
  useEffect(() => { const handler = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);
  const blocker = useBlocker(dirty && !busy);
  const set = (field: keyof Draft, value: string) => { setDraft(current => ({ ...current, [field]: value })); setDirty(true); };
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null); setBusy(true);
    try {
      const input = { name: draft.name, purchaseCost: draft.purchaseCost, purchaseDate: draft.purchaseDate, costMode: draft.costMode, initialUsageCount: draft.initialUsageCount, expiryDate: draft.expiryDate || null, note: draft.note, categoryId: draft.categoryId || null, lifecycleStatus: draft.lifecycleStatus, endedDate: draft.lifecycleStatus === 'active' ? null : draft.endedDate || null, salePrice: draft.salePrice };
      const saved = editing && source && assetId ? await updateAsset(assetId, source, input) : await createAsset(input);
      setDirty(false); navigate(`/assets/${saved.id}`, { replace: true });
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败，请重试。'); firstInput.current?.focus(); }
    finally { setBusy(false); }
  }
  if (!loaded) return <section><p>正在加载…</p></section>;
  if (missing) return <section><h1>资产不存在或已删除</h1><Link to="/">返回首页</Link></section>;
  if (categoryResult === undefined) return <section><p>正在加载类别…</p></section>;
  if (!categoryResult.value) return <section><ErrorMessage>{categoryResult.error}</ErrorMessage><button onClick={() => window.location.reload()}>重试</button></section>;
  const categories = categoryResult.value;
  return <section><h1>{editing ? '编辑资产' : '新增资产'}</h1><form onSubmit={submit} noValidate>
    <label>名称<input ref={firstInput} value={draft.name} maxLength={100} onChange={e => set('name', e.target.value)} required /></label>
    <label>购买金额（元）<input inputMode="decimal" value={draft.purchaseCost} onChange={e => set('purchaseCost', e.target.value)} required /></label>
    {draft.purchaseCost && Number(draft.purchaseCost) < 1000 && <small>建议主要记录约 ¥1000 以上的大件，此金额仍可保存。</small>}
    <label>购买日期<input type="date" value={draft.purchaseDate} max={localToday()} onChange={e => set('purchaseDate', e.target.value)} required /></label>
    <label>类别<select value={draft.categoryId} onChange={e => set('categoryId', e.target.value)}><option value="">未分类</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><small><Link to="/settings">在设置页管理类别</Link></small>
    <label>资产状态<select value={draft.lifecycleStatus} onChange={e => { set('lifecycleStatus', e.target.value); if (e.target.value === 'active') set('endedDate', ''); }}><option value="active">服役中</option><option value="retired">已退役</option><option value="sold">已卖出</option></select></label>
    {draft.lifecycleStatus !== 'active' && <label>结束日期<input type="date" min={draft.purchaseDate} max={localToday()} value={draft.endedDate} onChange={e => set('endedDate', e.target.value)} required /></label>}
    {draft.lifecycleStatus === 'sold' && (!editing || source?.lifecycleStatus !== 'sold') && <label>卖价（元，必填）<input inputMode="decimal" value={draft.salePrice} onChange={e => set('salePrice', e.target.value)} required /><small>保存时会同时新增一条“出售”收益，日期为结束日期。</small></label>}
    {draft.lifecycleStatus === 'sold' && editing && source?.lifecycleStatus === 'sold' && <small>再次编辑不会重复记录卖价；如需更正金额，请编辑详情中的出售收益流水。</small>}
    {editing && source?.lifecycleStatus === 'sold' && draft.lifecycleStatus !== 'sold' && <small>撤销卖出状态不会自动删除原出售收益，请自行核对。</small>}
    <fieldset><legend>主要观察方式</legend><label className="inline"><input type="radio" checked={draft.costMode === 'day'} onChange={() => set('costMode', 'day')} />按天</label><label className="inline"><input type="radio" checked={draft.costMode === 'use'} onChange={() => set('costMode', 'use')} />按次</label></fieldset>
    {!editing && draft.costMode === 'use' && <label>已有累计次数<input inputMode="numeric" value={draft.initialUsageCount} onChange={e => set('initialUsageCount', e.target.value)} /></label>}
    {editing && source && <small>已有使用次数 {source.usageCount} 次；普通编辑不会覆盖次数。</small>}
    <label>到期日期（可选）<input type="date" min={draft.purchaseDate} value={draft.expiryDate} onChange={e => set('expiryDate', e.target.value)} /></label><small>仅用于到期提示，不停止成本计算。</small>
    <label>备注（可选）<textarea value={draft.note} maxLength={2000} onChange={e => set('note', e.target.value)} /></label>
    {error && <ErrorMessage>{error}</ErrorMessage>}<div className="button-row"><Link className="button" to={editing && assetId ? `/assets/${assetId}` : '/'}>取消</Link><button className="primary" disabled={busy}>{busy ? '保存中…' : '保存'}</button></div>
  </form>{blocker.state === 'blocked' && <div className="dialog-backdrop"><section className="dialog" role="dialog" aria-modal="true"><h2>放弃未保存修改？</h2><p>离开后当前输入不会保留。</p><div className="button-row"><button autoFocus onClick={() => blocker.reset()}>继续编辑</button><button className="danger" onClick={() => blocker.proceed()}>放弃并离开</button></div></section></div>}</section>;
}
