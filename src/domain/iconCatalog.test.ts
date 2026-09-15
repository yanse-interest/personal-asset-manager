import { describe, expect, it } from 'vitest';
import { assetIcons, automaticAssetIconId } from './iconCatalog';

describe('asset icon catalog', () => {
  it('has 320 unique choices in the expected styles', () => {
    expect(assetIcons).toHaveLength(320);
    expect(new Set(assetIcons.map(icon => icon.id)).size).toBe(320);
    expect(assetIcons.filter(icon => icon.kind === '3d')).toHaveLength(100);
    expect(assetIcons.filter(icon => icon.kind === 'emoji')).toHaveLength(120);
    expect(assetIcons.filter(icon => icon.kind === 'line')).toHaveLength(100);
  });

  it('automatically matches common appliance and digital product names', () => {
    expect(automaticAssetIconId('小米扫地机器人')).toBe('line:robot-vacuum');
    expect(automaticAssetIconId('桌面净饮水机')).toBe('line:water-purifier');
    expect(automaticAssetIconId('家用跑步机')).toBe('line:treadmill');
    expect(automaticAssetIconId('iPad Pro')).toBe('line:tablet');
    expect(automaticAssetIconId('备用手机')).toBe('line:smartphone');
  });
});
