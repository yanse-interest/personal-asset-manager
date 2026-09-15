import { useState } from 'react';

type Theme = 'lime' | 'blue' | 'forest' | 'sand' | 'graphite';
type Mode = 'light' | 'dark' | 'system';
const themes: { value: Theme; name: string; description: string }[] = [
  { value: 'lime', name: '青柠黑', description: '清爽醒目' },
  { value: 'blue', name: '清透蓝', description: '明快理性' },
  { value: 'forest', name: '森林青', description: '柔和沉静' },
  { value: 'sand', name: '暖沙橙', description: '温暖生活感' },
  { value: 'graphite', name: '极简石墨', description: '克制低调' },
];
const barColors: Record<Theme, { light: string; dark: string }> = {
  lime: { light: '#d8ff62', dark: '#4e641d' },
  blue: { light: '#dbe7ff', dark: '#32477d' },
  forest: { light: '#d8f1e5', dark: '#2e604c' },
  sand: { light: '#f4dfc3', dark: '#614328' },
  graphite: { light: '#e3e4e7', dark: '#3b3d44' },
};

function validTheme(value: unknown): Theme {
  return themes.some(theme => theme.value === value) ? value as Theme : 'lime';
}
function validMode(value: unknown): Mode {
  return value === 'dark' || value === 'system' ? value : 'light';
}
function readPreference(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function updateBrowserBar(theme: Theme, mode: Mode) {
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', barColors[theme][dark ? 'dark' : 'light']);
}

export function applyAppearance(theme: Theme, mode: Mode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.mode = mode;
  try {
    localStorage.setItem('jiuyong-theme', theme);
    localStorage.setItem('jiuyong-mode', mode);
  } catch { /* Appearance remains usable when browser storage is unavailable. */ }
  updateBrowserBar(theme, mode);
}

export function applyStoredAppearance() {
  const theme = validTheme(readPreference('jiuyong-theme'));
  const mode = validMode(readPreference('jiuyong-mode'));
  applyAppearance(theme, mode);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (document.documentElement.dataset.mode === 'system') updateBrowserBar(validTheme(document.documentElement.dataset.theme), 'system');
  });
}

export function AppearanceSettings() {
  const [theme, setTheme] = useState<Theme>(() => validTheme(readPreference('jiuyong-theme')));
  const [mode, setMode] = useState<Mode>(() => validMode(readPreference('jiuyong-mode')));
  const chooseTheme = (value: Theme) => { setTheme(value); applyAppearance(value, mode); };
  const chooseMode = (value: Mode) => { setMode(value); applyAppearance(theme, value); };
  return <section className="appearance-settings">
    <h2>外观</h2>
    <div className="mode-options" aria-label="显示模式">{(['light', 'dark', 'system'] as Mode[]).map(value => <button type="button" key={value} aria-pressed={mode === value} className={mode === value ? 'active' : ''} onClick={() => chooseMode(value)}><i className={`mode-preview ${value}`}/><span>{value === 'light' ? '浅色' : value === 'dark' ? '深色' : '跟随系统'}</span></button>)}</div>
    <div className="theme-options" aria-label="主题颜色">{themes.map(item => <button type="button" key={item.value} aria-pressed={theme === item.value} className={theme === item.value ? 'active' : ''} onClick={() => chooseTheme(item.value)}><i className={`theme-preview ${item.value}`}><b/><b/></i><span><strong>{item.name}</strong><small>{item.description}</small></span><em>{theme === item.value ? '✓' : ''}</em></button>)}</div>
  </section>;
}
