import type { ReactNode } from 'react';

export type IconName = 'assets' | 'categories' | 'stats' | 'settings' | 'plus' | 'filter' | 'back' | 'chevron';

const paths: Record<IconName, ReactNode> = {
  assets: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
  categories: <path d="M20 13.5 13.5 20a2 2 0 0 1-2.8 0L4 13.3A2 2 0 0 1 4 10.5V5a1 1 0 0 1 1-1h5.5a2 2 0 0 1 1.4.6l8.1 8.1a1 1 0 0 1 0 1.4Z"/>,
  stats: <><path d="M5 20V10"/><path d="M12 20V4"/><path d="M19 20v-7"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  filter: <><path d="M4 7h16"/><path d="M7 12h10"/><path d="M10 17h4"/></>,
  back: <><path d="m15 18-6-6 6-6"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
};

export function AppIcon({ name, size = 22 }: { name: IconName; size?: number }) {
  return <svg className="app-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function assetEmoji(name: string, categoryName?: string | null): string {
  const value = `${name} ${categoryName ?? ''}`.toLowerCase();
  if (/咖啡|coffee/.test(value)) return '☕';
  if (/净水|水机|water/.test(value)) return '💧';
  if (/车|交通|汽车|car/.test(value)) return '🚗';
  if (/相机|摄影|镜头|camera/.test(value)) return '📷';
  if (/跑步|运动|健身|bike/.test(value)) return '🏃';
  if (/手机|phone/.test(value)) return '📱';
  if (/电脑|mac|book|数码|laptop/.test(value)) return '💻';
  if (/耳机|音响|speaker/.test(value)) return '🎧';
  if (/家居|沙发|家具/.test(value)) return '🛋️';
  return '📦';
}
