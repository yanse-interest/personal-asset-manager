import { useState } from 'react';
import { AssetIcon } from './AssetIcon';
import { assetIcons, type AssetIconKind } from '../domain/iconCatalog';
import { useModalFocus } from './useModalFocus';

type IconKindFilter = AssetIconKind | 'all';
const kinds: { value: IconKindFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: '3d', label: '立体' },
  { value: 'emoji', label: 'Emoji' },
  { value: 'line', label: '线性' },
];
const categories = ['全部', '家具', '数码', '家电', '家居', '厨具', '交通', '运动', '工具', '影音', '办公', '服饰', '户外', '其他'];

export function AssetIconPicker({ selectedId, onSelect, onClose }: { selectedId: string | null; onSelect: (id: string | null) => void; onClose: () => void }) {
  const dialogRef = useModalFocus(onClose);
  const [kind, setKind] = useState<IconKindFilter>('all');
  const [category, setCategory] = useState('全部');
  const [query, setQuery] = useState('');
  const filtered = assetIcons.filter(item => (kind === 'all' || item.kind === kind) && (category === '全部' || item.category === category) && (!query || `${item.label} ${item.category}`.toLowerCase().includes(query.toLowerCase())));
  return <div className="icon-picker-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className="icon-picker" role="dialog" aria-modal="true" aria-labelledby="icon-picker-title">
      <div className="icon-picker-heading"><div><h2 id="icon-picker-title">选择好物图标</h2><p>共 {assetIcons.length} 个，离线也能使用</p></div><button type="button" onClick={onClose} aria-label="关闭图标选择器">×</button></div>
      <button className="icon-picker-auto" type="button" onClick={() => onSelect(null)}>✨ 根据名称自动匹配{selectedId === null ? ' · 当前选中' : ''}</button>
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索边桌、电竞桌、支架…" aria-label="搜索图标" />
      <div className="icon-kind-tabs" aria-label="图标样式">{kinds.map(item => <button type="button" key={item.value} className={kind === item.value ? 'active' : ''} onClick={() => setKind(item.value)}>{item.label} {item.value === 'all' ? assetIcons.length : assetIcons.filter(icon => icon.kind === item.value).length}</button>)}</div>
      <div className="icon-category-tabs" aria-label="图标分类">{categories.map(item => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <p className="icon-picker-count">{filtered.length} 个图标</p>
      <div className="icon-picker-grid">{filtered.map(item => <button type="button" key={item.id} className={selectedId === item.id ? 'selected' : ''} aria-label={item.label} title={item.label} onClick={() => onSelect(item.id)}><AssetIcon id={item.id} size={47}/></button>)}</div>
      {filtered.length === 0 && <p className="icon-picker-empty">没有找到相关图标，试试别的关键词。</p>}
    </section>
  </div>;
}
