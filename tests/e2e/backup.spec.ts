import { AssetDatabase } from '../../src/data/db';
import type { Asset, CostRecord, RevenueRecord } from '../../src/domain/types';

const params = new URLSearchParams(location.search);
const role = params.get('role');
const result = document.querySelector('#result')!;
const timestamp = '2026-09-13T08:00:00.000Z';
const asset: Asset = { id: '11111111-1111-4111-8111-111111111111', name: '备份测试资产', purchaseCostCents: 100_000, purchaseDate: '2026-09-13', costMode: 'use', usageCount: 3, expiryDate: null, note: '备注 😀', createdAt: timestamp, updatedAt: timestamp };
const cost: CostRecord = { id: '22222222-2222-4222-8222-222222222222', assetId: asset.id, kind: 'consumable', amountCents: 500, date: '2026-09-13', note: '咖啡豆', createdAt: timestamp, updatedAt: timestamp };
const revenue: RevenueRecord = { id: '33333333-3333-4333-8333-333333333333', assetId: asset.id, amountCents: 100, date: '2026-09-13', note: null, createdAt: timestamp, updatedAt: timestamp };

async function run() {
  const database = new AssetDatabase();
  try {
    if (role === 'setup') {
      await database.assets.add(asset);
      await database.costRecords.add(cost);
      await database.revenueRecords.add(revenue);
    } else if (role === 'mutate') {
      await database.assets.update(asset.id, { name: '修改后的资产' });
      await database.costRecords.delete(cost.id);
      await database.revenueRecords.add({ ...revenue, id: '44444444-4444-4444-8444-444444444444' });
    } else if (role === 'verify' || role === 'mutated') {
      const [assets, costs, revenues] = await Promise.all([database.assets.toArray(), database.costRecords.toArray(), database.revenueRecords.toArray()]);
      if (role === 'verify' && (JSON.stringify(assets) !== JSON.stringify([asset]) || JSON.stringify(costs) !== JSON.stringify([cost]) || JSON.stringify(revenues) !== JSON.stringify([revenue]))) {
        throw new Error('下载文件重新导入后，三表未恢复原始全字段数据');
      }
      if (role === 'mutated' && (assets[0]?.name !== '修改后的资产' || costs.length !== 0 || revenues.length !== 2)) {
        throw new Error('取消导入后，修改后的原库不应变化');
      }
    } else throw new Error('未知测试角色');
    document.documentElement.dataset.result = 'passed';
    result.textContent = role ?? 'passed';
  } catch (error) {
    document.documentElement.dataset.result = 'failed';
    result.textContent = error instanceof Error ? error.message : String(error);
  } finally { database.close(); }
}
void run();
