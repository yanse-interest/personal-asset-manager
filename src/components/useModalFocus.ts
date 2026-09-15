import { useEffect, useRef } from 'react';

export function useModalFocus(onClose: () => void, busy = false) {
  const dialog = useRef<HTMLElement>(null);
  const latest = useRef({ onClose, busy });
  latest.current = { onClose, busy };
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    if (!element) return;
    const focusable = () => [...element.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')]
      .filter(item => !item.matches(':disabled') && item.tabIndex >= 0 && item.getClientRects().length > 0);
    (focusable()[0] ?? element).focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!latest.current.busy) latest.current.onClose();
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0]; const last = items.at(-1);
      if (!first || !last) { event.preventDefault(); element.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    element.addEventListener('keydown', keydown);
    return () => { element.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, []);
  return dialog;
}
