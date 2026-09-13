import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
interface PwaState {
  available: boolean;
  offlineReady: boolean;
  needRefresh: boolean;
  error: string | null;
  installAvailable: boolean;
  installed: boolean;
  update: () => Promise<void>;
  install: () => Promise<void>;
}
const PwaContext = createContext<PwaState | null>(null);

export function PwaProvider({ children }: { children: ReactNode }) {
  const available = import.meta.env.PROD && window.isSecureContext && 'serviceWorker' in navigator;
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError: () => setError('离线缓存注册失败。请检查安全来源、浏览器设置和可用空间后刷新重试。'),
  });

  useEffect(() => {
    if (!available) return;
    let mounted = true;
    void navigator.serviceWorker.ready.then(registration => {
      if (mounted && registration.active) setActive(true);
    }).catch(() => { if (mounted) setError('离线缓存尚未就绪，请刷新后重试。'); });
    return () => { mounted = false; };
  }, [available]);
  useEffect(() => {
    if (!available) return;
    const refresh = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      void navigator.serviceWorker.getRegistration().then(registration => registration?.update()).catch(() => {});
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [available]);
  useEffect(() => {
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onInstallPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  async function update() {
    try { await updateServiceWorker(true); }
    catch { setError('更新失败。当前数据仍在本机，请稍后重试。'); }
  }
  async function install() {
    if (!installPrompt) return;
    try { await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }
    catch { setError('无法打开安装提示，请使用浏览器的“添加到主屏幕”操作。'); }
  }
  return <PwaContext.Provider value={{ available, offlineReady: available && (active || offlineReady), needRefresh, error, installAvailable: available && Boolean(installPrompt), installed, update, install }}>
    {children}
  </PwaContext.Provider>;
}

export function usePwa(): PwaState {
  const state = useContext(PwaContext);
  if (!state) throw new Error('PWA 状态未初始化');
  return state;
}
