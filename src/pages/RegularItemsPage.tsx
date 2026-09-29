import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useBlocker, useParams } from 'react-router';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorMessage } from '../components/ErrorMessage';
import { deleteRegularItem, deleteRegularPurchase, deleteRegularVariant, regularSnapshot, saveRegularItem, saveRegularPurchase, saveRegularVariant } from '../data/regularItems';
import { localToday } from '../domain/dates';
import { formatCents, formatRatio } from '../domain/money';
import { purchaseStats, sortPurchases } from '../domain/regularItems';
import type { RegularItem, RegularPurchase, RegularVariant } from '../domain/types';

type DeleteTarget = { kind: 'item'; value: RegularItem } | { kind: 'variant'; value: RegularVariant } | { kind: 'purchase'; value: RegularPurchase };
const yuan = (cents: number) => (cents / 100).toFixed(2);

export function RegularItemsPage() {
  const { itemId } = useParams();
  const result = useLiveQuery(async () => { try { return { data: await regularSnapshot(), error: null as string | null }; } catch { return { data: null, error: '无法读取常买物品，请刷新后重试。' }; } });
  const [itemName, setItemName] = useState('');
  const [editingItem, setEditingItem] = useState<RegularItem | null>(null);
  const [variantName, setVariantName] = useState('');
  const [specification, setSpecification] = useState('');
  const [platform, setPlatform] = useState('');
  const [editingVariant, setEditingVariant] = useState<RegularVariant | null>(null);
  const [variantId, setVariantId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(localToday());
  const [quantity, setQuantity] = useState('1');
  const [paidYuan, setPaidYuan] = useState('');
  const [note, setNote] = useState('');
  const [editingPurchase, setEditingPurchase] = useState<RegularPurchase | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemDirty = itemName !== (editingItem?.name ?? '');
  const variantDirty = variantName !== (editingVariant?.name ?? '') || specification !== (editingVariant?.specification ?? '') || platform !== (editingVariant?.platform ?? '');
  const purchaseDirty = variantId !== (editingPurchase?.variantId ?? '') || purchaseDate !== (editingPurchase?.date ?? localToday()) || quantity !== (editingPurchase ? String(editingPurchase.quantity) : '1') || paidYuan !== (editingPurchase ? yuan(editingPurchase.paidCents) : '') || note !== (editingPurchase?.note ?? '');
  const dirty = itemDirty || variantDirty || purchaseDirty;
  const blocker = useBlocker(() => busy || dirty);
  useEffect(() => {
    if (!busy && !dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy, dirty]);

  if (result === undefined) return <section className="loading-state"><p>正在加载常买物品…</p></section>;
  if (result.error || !result.data) return <section><h1>常买物品</h1><ErrorMessage>{result.error ?? '无法读取数据。'}</ErrorMessage></section>;
  const { items, variants, purchases } = result.data;
  const item = itemId ? items.find(row => row.id === itemId) : null;
  const itemVariants = item ? variants.filter(row => row.itemId === item.id).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')) : [];
  const itemVariantIds = new Set(itemVariants.map(row => row.id));
  const itemPurchases = purchases.filter(row => itemVariantIds.has(row.variantId));

  async function saveItem(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(null);
    try { await saveRegularItem(itemName, editingItem ?? undefined); setItemName(''); setEditingItem(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败。'); }
    finally { setBusy(false); }
  }
  async function saveVariant(event: FormEvent) {
    event.preventDefault(); if (busy || !item) return; setBusy(true); setError(null);
    try { await saveRegularVariant({ itemId: item.id, name: variantName, specification, platform }, editingVariant ?? undefined); setVariantName(''); setSpecification(''); setPlatform(''); setEditingVariant(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败。'); }
    finally { setBusy(false); }
  }
  async function savePurchase(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(null);
    try {
      if (!/^[1-9]\d*$/.test(quantity)) throw new Error('购买数量必须是正整数。');
      await saveRegularPurchase({ variantId, date: purchaseDate, quantity: Number(quantity), paidYuan, note }, editingPurchase ?? undefined);
      setEditingPurchase(null); setVariantId(''); setPurchaseDate(localToday()); setQuantity('1'); setPaidYuan(''); setNote('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败。'); }
    finally { setBusy(false); }
  }
  async function confirmDelete() {
    if (!deleting || busy) return; setBusy(true); setError(null);
    try {
      if (deleting.kind === 'item') await deleteRegularItem(deleting.value);
      else if (deleting.kind === 'variant') await deleteRegularVariant(deleting.value);
      else await deleteRegularPurchase(deleting.value);
      setDeleting(null);
    } catch (reason) { setDeleting(null); setError(reason instanceof Error ? reason.message : '删除失败。'); }
    finally { setBusy(false); }
  }
  function editPurchase(row: RegularPurchase) { setEditingPurchase(row); setVariantId(row.variantId); setPurchaseDate(row.date); setQuantity(String(row.quantity)); setPaidYuan(yuan(row.paidCents)); setNote(row.note ?? ''); setError(null); }

  if (itemId && !item) return <section className="main-subpage"><h1>常买物品不存在</h1><Link className="button" to="/regular">返回常买物品</Link></section>;
  if (!item) return <section className="main-subpage regular-page" data-pwa-busy={busy ? 'true' : undefined}>
    <div className="main-page-heading"><div><h1>常买物品</h1><p>记下重复购买的日常消耗品</p></div></div>
    <form onSubmit={saveItem} data-pwa-dirty={itemDirty ? 'true' : 'false'}><h2>{editingItem ? '修改物品名称' : '添加常买物品'}</h2><label>物品名称<input value={itemName} maxLength={100} placeholder="例如：咖啡豆" onChange={event => setItemName(event.target.value)} required /></label><div className="button-row"><button className="primary" disabled={busy}>{editingItem ? '保存名称' : '添加物品'}</button>{editingItem && <button type="button" disabled={busy} onClick={() => { setEditingItem(null); setItemName(''); }}>取消</button>}</div></form>
    {error && <ErrorMessage>{error}</ErrorMessage>}
    {items.length === 0 ? <div className="empty-state">还没有常买物品。先添加一种常买的日常消耗品。</div> : <div className="regular-list">{[...items].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')).map(row => {
      const rowVariants = variants.filter(v => v.itemId === row.id);
      const ids = new Set(rowVariants.map(v => v.id));
      const rowPurchases = purchases.filter(p => ids.has(p.variantId));
      const latest = sortPurchases(rowPurchases)[0];
      return <article className="regular-card" key={row.id}><Link to={`/regular/${row.id}`}><strong>{row.name}</strong><small>{rowVariants.length} 款 · {rowPurchases.length} 次购买{latest ? ` · 最近 ${latest.date}` : ''}</small></Link><div className="button-row"><button type="button" onClick={() => { setEditingItem(row); setItemName(row.name); setError(null); }}>改名</button><button type="button" className="danger" onClick={() => setDeleting({ kind: 'item', value: row })}>删除</button></div></article>;
    })}</div>}
    {deleting && <ConfirmDialog title="删除常买物品？" confirmLabel="删除" busy={busy} onCancel={() => setDeleting(null)} onConfirm={confirmDelete}><p>只有先删完关联款式和购买记录，才能删除物品。</p></ConfirmDialog>}
    {blocker.state === 'blocked' && <ConfirmDialog title={busy ? '正在保存' : '放弃未保存输入？'} confirmLabel="放弃并离开" busy={busy} onCancel={() => blocker.reset()} onConfirm={() => blocker.proceed()}><p>离开后未保存的常买物品输入不会保留。</p></ConfirmDialog>}
  </section>;

  return <section className="main-subpage regular-page" data-pwa-busy={busy ? 'true' : undefined}>
    <div className="main-page-heading"><div><h1>{item.name}</h1><p>{itemVariants.length} 款 · {itemPurchases.length} 次购买</p></div><Link className="text-action" to="/regular">返回</Link></div>
    <div className="stats-card"><h2>购买概览</h2><div className="stats-metric-grid"><div><small>购买次数</small><strong>{itemPurchases.length}</strong></div><div><small>累计实付</small><strong>{formatCents(itemPurchases.reduce((sum, row) => sum + row.paidCents, 0))}</strong></div></div><p>各款规格不同，价格只在同一款内比较；这里不推算库存或补货日期。</p></div>
    <form onSubmit={saveVariant} data-pwa-dirty={variantDirty ? 'true' : 'false'}><h2>{editingVariant ? '编辑常买款式' : '添加常买款式'}</h2><label>款式名称<input value={variantName} maxLength={100} placeholder="例如：深烘咖啡豆" onChange={event => setVariantName(event.target.value)} required /></label><label>每件规格<input value={specification} maxLength={60} placeholder="例如：250g / 包" onChange={event => setSpecification(event.target.value)} disabled={Boolean(editingVariant && purchases.some(row => row.variantId === editingVariant.id))} required /></label><label>购买平台<input value={platform} maxLength={60} placeholder="例如：淘宝某店" onChange={event => setPlatform(event.target.value)} disabled={Boolean(editingVariant && purchases.some(row => row.variantId === editingVariant.id))} required /></label>{editingVariant && purchases.some(row => row.variantId === editingVariant.id) && <small>已有购买记录时只能改名称；新规格或平台请另建一款。</small>}<div className="button-row"><button className="primary" disabled={busy}>{editingVariant ? '保存款式' : '添加款式'}</button>{editingVariant && <button type="button" onClick={() => { setEditingVariant(null); setVariantName(''); setSpecification(''); setPlatform(''); }}>取消</button>}</div></form>
    {itemVariants.length > 0 && <form onSubmit={savePurchase} data-pwa-dirty={purchaseDirty ? 'true' : 'false'}><h2>{editingPurchase ? '编辑购买记录' : '记一次购买'}</h2><label>购买款式<select value={variantId} onChange={event => setVariantId(event.target.value)} required><option value="">请选择</option>{itemVariants.map(row => <option value={row.id} key={row.id}>{row.name} · {row.specification} · {row.platform}</option>)}</select></label><label>购买日期<input type="date" max={localToday()} value={purchaseDate} onChange={event => setPurchaseDate(event.target.value)} required /></label><label>买了几件<input inputMode="numeric" value={quantity} onChange={event => setQuantity(event.target.value)} required /></label><label>整笔实付金额（元）<input inputMode="decimal" value={paidYuan} placeholder="含优惠后的实付" onChange={event => setPaidYuan(event.target.value)} required /></label><label>备注（可选）<input value={note} maxLength={500} onChange={event => setNote(event.target.value)} /></label><small>单件价格＝实付金额 ÷ 件数。若一单有不同款式，请按款分别记录对应实付金额。</small><div className="button-row"><button className="primary" disabled={busy}>{editingPurchase ? '保存修改' : '保存购买'}</button>{editingPurchase && <button type="button" onClick={() => { setEditingPurchase(null); setVariantId(''); setQuantity('1'); setPaidYuan(''); setNote(''); }}>取消</button>}</div></form>}
    {error && <ErrorMessage>{error}</ErrorMessage>}
    <h2 className="regular-section-title">款式与价格</h2>
    {itemVariants.length === 0 ? <p>先添加一款常买商品，再记购买价格。</p> : itemVariants.map(variant => {
      const rows = sortPurchases(purchases.filter(row => row.variantId === variant.id));
      const stats = purchaseStats(rows);
      const latestUnit = stats.latest ? stats.latest.paidCents / stats.latest.quantity : null;
      const previousUnit = stats.previous ? stats.previous.paidCents / stats.previous.quantity : null;
      const delta = latestUnit !== null && previousUnit !== null ? latestUnit - previousUnit : null;
      return <article className="regular-card" key={variant.id}><div className="regular-card-head"><div><h3>{variant.name}</h3><small>{variant.specification} · {variant.platform}</small></div><span>{rows.length} 次</span></div>
        {stats.latest ? <><div className="regular-price"><small>最近单件实付</small><strong>{formatRatio(stats.latest.paidCents, stats.latest.quantity)}</strong></div><div className="regular-facts"><span>历史最低 {formatCents(Math.round(stats.minUnitCents!))}</span><span>历史最高 {formatCents(Math.round(stats.maxUnitCents!))}</span><span>累计实付 {formatCents(stats.totalPaidCents)}</span></div><p className="regular-change">{delta === null ? '再记一次购买后可比较价格变化。' : delta === 0 ? '与上次单件价格相同' : `比上次每件${delta > 0 ? '贵' : '便宜'} ${formatCents(Math.round(Math.abs(delta)))}`}</p></> : <p>尚无购买记录</p>}
        <div className="button-row"><button type="button" onClick={() => { setVariantId(variant.id); setEditingPurchase(null); setPaidYuan(''); setQuantity('1'); setPurchaseDate(localToday()); setNote(''); }}>记这款</button><button type="button" onClick={() => { setEditingVariant(variant); setVariantName(variant.name); setSpecification(variant.specification); setPlatform(variant.platform); }}>编辑</button><button className="danger" type="button" onClick={() => setDeleting({ kind: 'variant', value: variant })}>删除</button></div>
        {rows.length > 0 && <div className="regular-history"><h4>购买记录</h4>{rows.map(row => <div className="regular-history-row" key={row.id}><div><strong>{row.date} · {row.quantity} 件 · {formatCents(row.paidCents)}</strong><small>每件 {formatRatio(row.paidCents, row.quantity)}{row.note ? ` · ${row.note}` : ''}</small></div><div className="button-row"><button type="button" onClick={() => editPurchase(row)}>编辑</button><button className="danger" type="button" onClick={() => setDeleting({ kind: 'purchase', value: row })}>删除</button></div></div>)}</div>}
      </article>;
    })}
    {deleting && <ConfirmDialog title={deleting.kind === 'purchase' ? '删除购买记录？' : '删除款式？'} confirmLabel="删除" busy={busy} onCancel={() => setDeleting(null)} onConfirm={confirmDelete}><p>{deleting.kind === 'purchase' ? '这次购买将从价格历史中移除。' : '只有先删完该款的购买记录，才能删除款式。'}</p></ConfirmDialog>}
    {blocker.state === 'blocked' && <ConfirmDialog title={busy ? '正在保存' : '放弃未保存输入？'} confirmLabel="放弃并离开" busy={busy} onCancel={() => blocker.reset()} onConfirm={() => blocker.proceed()}><p>离开后未保存的款式或购买记录输入不会保留。</p></ConfirmDialog>}
  </section>;
}
