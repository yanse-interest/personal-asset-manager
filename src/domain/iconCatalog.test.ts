import { describe, expect, it } from 'vitest';
import { assetIcons, automaticAssetIconId } from './iconCatalog';

describe('asset icon catalog', () => {
  it('has unique choices across the expected styles', () => {
    expect(assetIcons).toHaveLength(496);
    expect(new Set(assetIcons.map(icon => icon.id)).size).toBe(496);
    expect(assetIcons.filter(icon => icon.kind === '3d')).toHaveLength(259);
    expect(assetIcons.filter(icon => icon.kind === 'emoji')).toHaveLength(120);
    expect(assetIcons.filter(icon => icon.kind === 'line')).toHaveLength(117);
  });

  it('automatically matches common appliance and digital product names', () => {
    expect(automaticAssetIconId('小米扫地机器人')).toBe('line:robot-vacuum');
    expect(automaticAssetIconId('桌面净饮水机')).toBe('line:water-purifier');
    expect(automaticAssetIconId('家用跑步机')).toBe('line:treadmill');
    expect(automaticAssetIconId('iPad Pro')).toBe('line:tablet');
    expect(automaticAssetIconId('备用手机')).toBe('line:smartphone');
    expect(automaticAssetIconId('电竞桌')).toBe('line:gaming-desk');
    expect(automaticAssetIconId('床边柜')).toBe('line:bedside-cabinet');
    expect(automaticAssetIconId('客厅边桌')).toBe('line:side-table');
    expect(automaticAssetIconId('显示器增高架')).toBe('line:monitor-riser');
    expect(automaticAssetIconId('折叠笔记本支架')).toBe('line:folding-laptop-stand');
    expect(automaticAssetIconId('麦克风支架')).toBe('line:microphone-stand');
  });
});
