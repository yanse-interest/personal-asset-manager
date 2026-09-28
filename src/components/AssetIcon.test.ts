import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { assetIcons, assetIconById } from '../domain/iconCatalog';
import { AssetIcon, hasAssetIconDrawing } from './AssetIcon';

describe('asset icon rendering', () => {
  it('renders every choice and historical selection as an outline SVG', () => {
    for (const id of assetIconById.keys()) {
      expect(hasAssetIconDrawing(assetIconById.get(id)!.value), id).toBe(true);
      const markup = renderToStaticMarkup(createElement(AssetIcon, { id, size: 48 }));
      expect(markup, id).toContain('<svg');
      expect(markup, id).not.toContain('<img');
      expect(markup, id).not.toContain('<span');
    }
    expect(assetIcons.length).toBeGreaterThan(400);
  });

  it('uses an outline fallback for unmatched names', () => {
    expect(renderToStaticMarkup(createElement(AssetIcon, { name: '未知物品' }))).toContain('<svg');
  });
});
