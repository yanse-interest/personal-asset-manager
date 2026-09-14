import { createHashRouter, Link } from 'react-router';
import { App } from './App';
import { DashboardPage } from '../pages/DashboardPage';
import { AssetFormPage } from '../pages/AssetFormPage';
import { AssetDetailPage } from '../pages/AssetDetailPage';
import { RecordFormPage } from '../pages/RecordFormPage';
import { SettingsPage } from '../pages/SettingsPage';
import { StatusLedgerPage } from '../pages/StatusLedgerPage';
import { CategoryLedgerPage } from '../pages/CategoryLedgerPage';

function Placeholder({ title }: { title: string }) {
  return <section><h1>{title}</h1><p>此页面将在后续阶段实现。</p><Link to="/">返回首页</Link></section>;
}

export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'ledgers/:status', element: <StatusLedgerPage /> },
      { path: 'categories/:categoryId', element: <CategoryLedgerPage /> },
      { path: 'assets/new', element: <AssetFormPage /> },
      { path: 'assets/:assetId/edit', element: <AssetFormPage /> },
      { path: 'assets/:assetId', element: <AssetDetailPage /> },
      { path: 'assets/:assetId/records/new', element: <RecordFormPage /> },
      { path: 'assets/:assetId/costs/:recordId/edit', element: <RecordFormPage table="cost" /> },
      { path: 'assets/:assetId/revenues/:recordId/edit', element: <RecordFormPage table="revenue" /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Placeholder title="页面不存在" /> },
    ],
  },
]);
