import { useEffect, useState, type FormEvent } from 'react';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorMessage } from '../components/ErrorMessage';
import { getAsset } from '../data/assets';
import { createRecord, deleteRecord, getCostRecord, getRevenueRecord, updateCostRecord, updateRevenueRecord, type RecordSnapshot, type RecordType } from '../data/records';
import { localToday } from '../domain/dates';
import type { Asset } from '../domain/types';

interface Draft { type: RecordType; amount: string; date: string; note: string }
const labels: Record<RecordType, string> = { additional: '后续本体投入', consumable: '耗材投入', revenue: '收益' };
const validType = (value: string | null): value is RecordType => value === 'additional' || value === 'consumable' || value === 'revenue';

export function RecordFormPage({ table }: { table?: 'cost' | 'revenue' }) {
  const { assetId = '', recordId = '' } = useParams(); const [params] = useSearchParams(); const navigate = useNavigate();
  const editing = Boolean(table && recordId); const requested = validType(params.get('type')) ? params.get('type') as RecordType : 'additional';
  const [asset, setAsset] = useState<Asset | null>(null); const [source, setSource] = useState<RecordSnapshot | null>(null);
  const [draft, setDraft] = useState<Draft>({ type: requested, amount: '', date: localToday(), note: '' });
  const [loaded, setLoaded] = useState(false); const [missing, setMissing] = useState(false); const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false); const [confirmDelete, setConfirmDelete] = useState(false);
  const blocker = useBlocker(dirty && !busy);

  useEffect(() => {
    void (async () => {
      try {
        const parent = await getAsset(assetId); if (!parent) { setMissing(true); return; } setAsset(parent);
        if (!editing) return;
        const record = table === 'cost' ? await getCostRecord(assetId, recordId) : await getRevenueRecord(assetId, recordId);
        if (!record) { setMissing(true); return; }
        const snapshot: RecordSnapshot = table === 'cost' ? { table: 'cost', record: record as Extract<RecordSnapshot, { table: 'cost' }>['record'] } : { table: 'revenue', record: record as Extract<RecordSnapshot, { table: 'revenue' }>['record'] };
        setSource(snapshot); setDraft({ type: table === 'cost' ? (snapshot.record as Extract<RecordSnapshot, { table: 'cost' }>['record']).kind : 'revenue', amount: (snapshot.record.amountCents / 100).toFixed(2), date: snapshot.record.date, note: snapshot.record.note ?? '' });
      } catch { setError('无法读取流水，请刷新后重试。'); } finally { setLoaded(true); }
    })();
  }, [assetId, editing, recordId, table]);
  useEffect(() => { const handler = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);
  const set = (field: keyof Draft, value: string) => { setDraft(current => ({ ...current, [field]: value })); setDirty(true); };

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const input = { type: draft.type, amount: draft.amount, date: draft.date, note: draft.note };
      if (!editing) await createRecord(assetId, input);
      else if (source?.table === 'cost' && draft.type !== 'revenue') await updateCostRecord(assetId, source.record, { ...input, type: draft.type });
      else if (source?.table === 'revenue') await updateRevenueRecord(assetId, source.record, input);
      else throw new Error('流水类型无效');
      setDirty(false); navigate(`/assets/${assetId}`, { replace: true });
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败，请重试。'); } finally { setBusy(false); }
  }
  async function remove() {
    if (!source) return; setBusy(true); setError(null);
    try { await deleteRecord(source); setDirty(false); navigate(`/assets/${assetId}`, { replace: true }); }
    catch (reason) { setConfirmDelete(false); setError(reason instanceof Error ? reason.message : '删除失败，请重试。'); }
    finally { setBusy(false); }
  }
  if (!loaded) return <section><p>正在加载…</p></section>;
  if (missing || !asset) return <section><h1>记录不存在或已删除</h1><Link to={assetId ? `/assets/${assetId}` : '/'}>返回</Link></section>;
  return <section><h1>{editing ? `编辑${labels[draft.type]}` : '新增投入或收益'}</h1><p>所属资产：{asset.name}</p><form onSubmit={submit} noValidate>
    {(!editing || table === 'cost') && <fieldset><legend>类型</legend>{(['additional', 'consumable', ...(editing ? [] : ['revenue'])] as RecordType[]).map(type => <label className="inline" key={type}><input type="radio" checked={draft.type === type} onChange={() => set('type', type)} />{labels[type]}</label>)}</fieldset>}
    {draft.type === 'revenue' && <small>收益将从净投入中扣减。</small>}
    <label>金额（元）<input inputMode="decimal" value={draft.amount} onChange={e => set('amount', e.target.value)} required /></label>
    <label>日期<input type="date" min={asset.purchaseDate} max={localToday()} value={draft.date} onChange={e => set('date', e.target.value)} required /></label>
    <label>备注（可选）<textarea maxLength={2000} value={draft.note} onChange={e => set('note', e.target.value)} /></label>
    {error && <ErrorMessage>{error}</ErrorMessage>}<div className="button-row"><Link className="button" to={`/assets/${assetId}`}>取消</Link>{editing && <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>删除</button>}<button className="primary" disabled={busy}>{busy ? '保存中…' : '保存'}</button></div>
  </form>
    {confirmDelete && source && <ConfirmDialog title={`删除${labels[draft.type]}？`} confirmLabel="删除流水" busy={busy} onCancel={() => setConfirmDelete(false)} onConfirm={remove}><p>{source.record.date} · {(source.record.amountCents / 100).toFixed(2)} 元。删除后不可撤销。</p></ConfirmDialog>}
    {blocker.state === 'blocked' && <div className="dialog-backdrop"><section className="dialog" role="dialog" aria-modal="true"><h2>放弃未保存修改？</h2><p>离开后当前输入不会保留。</p><div className="button-row"><button autoFocus onClick={() => blocker.reset()}>继续编辑</button><button className="danger" onClick={() => blocker.proceed()}>放弃并离开</button></div></section></div>}
  </section>;
}
