import { useId, type ReactNode } from 'react';
import { useModalFocus } from './useModalFocus';
export function ConfirmDialog({ title, children, confirmLabel, busy = false, onCancel, onConfirm }: {
  title: string; children: ReactNode; confirmLabel: string; busy?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const dialogRef = useModalFocus(onCancel, busy);
  const titleId = useId();
  return <div className="dialog-backdrop"><section ref={dialogRef} tabIndex={-1} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
    <h2 id={titleId}>{title}</h2>{children}<div className="button-row">
      <button type="button" onClick={onCancel} disabled={busy}>取消</button>
      <button type="button" className="danger" onClick={onConfirm} disabled={busy}>{busy ? '处理中…' : confirmLabel}</button>
    </div></section></div>;
}
