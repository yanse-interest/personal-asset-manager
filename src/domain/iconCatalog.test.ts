import { describe, expect, it } from 'vitest';
import { assetIcons, assetIconById, automaticAssetIconId, normalizedAssetIconId } from './iconCatalog';
import convertedLineArt from './convertedLineArt.json';

describe('asset icon catalog', () => {
  it('offers only line icons while retaining historic selections', () => {
    expect(assetIcons.length).toBeGreaterThan(400);
    expect(new Set(assetIcons.map(icon => icon.id)).size).toBe(assetIcons.length);
    expect(assetIcons.every(icon => icon.kind === 'line' && icon.id.startsWith('line:'))).toBe(true);
    for (const name of Object.keys(convertedLineArt)) {
      const oldId = `3d:${name.toLowerCase().replaceAll(' ', '_')}`;
      expect(assetIconById.get(oldId)?.kind).toBe('line');
      expect(normalizedAssetIconId(oldId)).toMatch(/^line:/);
    }
    for (const category of ['数码', '交通', '家居', '运动', '工具', '其他']) {
      for (let index = 0; index < 20; index += 1) expect(assetIconById.get(`emoji:${category}:${index}`)?.kind, `emoji:${category}:${index}`).toBe('line');
    }
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
    expect(automaticAssetIconId('厨房空气炸锅')).toBe('line:air-fryer');
    expect(automaticAssetIconId('桌面扩展坞')).toBe('line:docking-station');
    expect(automaticAssetIconId('猫砂盆')).toBe('line:litter-box');
  });
});
