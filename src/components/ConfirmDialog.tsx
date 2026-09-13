import { useEffect, useRef, type ReactNode } from 'react';
export function ConfirmDialog({ title, children, confirmLabel, busy = false, onCancel, onConfirm }: {
  title: string; children: ReactNode; confirmLabel: string; busy?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  return <div className="dialog-backdrop"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
    <h2 id="confirm-title">{title}</h2>{children}<div className="button-row">
      <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy}>取消</button>
      <button type="button" className="danger" onClick={onConfirm} disabled={busy}>{busy ? '处理中…' : confirmLabel}</button>
    </div></section></div>;
}
