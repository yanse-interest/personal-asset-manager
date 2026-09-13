import { createAsset, incrementUsage } from '../../src/data/assets';
import { AssetDatabase } from '../../src/data/db';

const result = document.querySelector('#result')!;
const parameters = new URLSearchParams(location.search);
const role = parameters.get('role');
const databaseName = parameters.get('database');

async function run() {
  if (!databaseName) throw new Error('缺少 database 参数');
  const database = new AssetDatabase(databaseName);
  try {
    if (role === 'setup') {
      const asset = await createAsset({
        name: '浏览器并发测试', purchaseCost: '100', purchaseDate: '2026-09-13', costMode: 'use',
        initialUsageCount: '0', expiryDate: null, note: null,
      }, database, new Date('2026-09-13T08:00:00.000Z'));
      document.documentElement.dataset.assetId = asset.id;
      result.textContent = asset.id;
    } else if (role === 'increment') {
      const assetId = parameters.get('asset');
      if (!assetId) throw new Error('缺少 asset 参数');
      await incrementUsage(assetId, database);
      result.textContent = 'incremented';
    } else if (role === 'verify') {
      const assetId = parameters.get('asset');
      if (!assetId) throw new Error('缺少 asset 参数');
      const stored = await database.assets.get(assetId);
      if (stored?.usageCount !== 2) throw new Error(`期望次数 2，实际 ${String(stored?.usageCount)}`);
      result.textContent = 'count is 2';
    } else {
      throw new Error('未知测试角色');
    }
    document.documentElement.dataset.result = 'passed';
  } catch (error) {
    document.documentElement.dataset.result = 'failed';
    result.textContent = `FAIL: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    database.close();
  }
}

void run();
