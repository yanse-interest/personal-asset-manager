import type { ReactNode } from 'react';

const drawings: Record<string, ReactNode> = {
  desk: <><path d="M2 7h20v3H2zM4 10v11m16-11v11M15 10v7h5M15 13h5M17.5 11.5h.01M17.5 14.5h.01"/></>,
  'gaming-desk': <><path d="M3 9h18l2 3H1l2-3ZM4 12v9m16-9v9M9 12l-2 9m8-9 2 9M9 3h6v6H9zM12 3V2m-2 7v2m4-2v2"/></>,
  'side-table': <><path d="M4 6h16v3H4zM6 9v12m12-12v12M6 16h12M8 19h8"/></>,
  'bedside-cabinet': <><path d="M4 3h16v17H4zM3 3h18M6 20v2m12-2v2M4 10h16M4 15h16M11 7h2m-2 6h2"/></>,
  'coffee-table': <><path d="M2 9h20v3H2zM5 12l-1 9m15-9 1 9M7 17h10"/></>,
  'dining-table': <><path d="M4 8h16l2 3H2l2-3ZM6 11v10m12-10v10M1 15h4m14 0h4M2 15v6m20-6v6"/></>,
  bookshelf: <><path d="M4 2h16v20H4zM4 9h16M4 16h16M7 4v5m3-5v5m3-5v5m4 0V4M7 11v5m3-5v5m4-5v5m3-5v5M8 18v4m4-4v4m4-4v4"/></>,
  wardrobe: <><path d="M4 2h16v20H4zM12 2v20M9 10v4m6-4v4M4 19h16"/></>,
  'shoe-rack': <><path d="M3 4v17m18-17v17M3 10h18M3 17h18M6 8c1 1 3 1 5 0m2 0c1 1 3 1 5 0M6 15c1 1 3 1 5 0m2 0c1 1 3 1 5 0"/></>,
  'display-shelf': <><path d="M3 2v20m18-20v20M3 7h18M3 14h18M3 21h18M7 4v3m7-3v3M8 11v3m7-3v3M10 17v4"/></>,
  'monitor-riser': <><rect x="4" y="2" width="16" height="10" rx="1"/><path d="M12 12v4m-3 0h6M2 17h20M4 17v4m16-4v4M4 21h16"/></>,
  'laptop-stand': <><path d="M5 4h14v9H5zM3 15h18l-2-2H5l-2 2ZM12 15l-3 5m3-5 3 5M6 20h12"/></>,
  'adjustable-laptop-stand': <><path d="M5 3h14v9H5zM3 14h18l-2-2H5l-2 2ZM12 14v3m0 0-4 4m4-4 4 4M5 21h14M16 16l2-2"/></>,
  'folding-laptop-stand': <><path d="M5 4h14v9H5zM3 15h18l-2-2H5l-2 2ZM5 21l7-6 7 6M12 15v4M5 21h14"/></>,
  'vertical-laptop-stand': <><rect x="8" y="2" width="8" height="17" rx="1"/><path d="M7 15H5v6h14v-6h-2M10 19v2m4-2v2M5 21h14"/></>,
  'microphone-stand': <><rect x="9" y="2" width="6" height="9" rx="3"/><path d="M7 8a5 5 0 0 0 10 0M12 13v5m0 0-5 4m5-4 5 4m-5-4v4"/></>,
  'microphone-boom-arm': <><path d="M2 21h6m-3 0v-5m-2 0h4m-2 0 5-8 5 4 3-5M10 8l5-4 3 3M15 12l3-5"/><rect x="17" y="3" width="4" height="7" rx="2"/></>,
};

export const specialLineIconNames = new Set(Object.keys(drawings));

export function SpecialLineIcon({ name, size = 24, strokeWidth = 2 }: { name: string; size?: number; strokeWidth?: number }) {
  const drawing = drawings[name];
  if (!drawing) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{drawing}</svg>;
}
