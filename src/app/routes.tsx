import { createHashRouter, Link } from 'react-router';
import { App } from './App';
import { DashboardPage } from '../pages/DashboardPage';
import { AssetFormPage } from '../pages/AssetFormPage';
import { AssetDetailPage } from '../pages/AssetDetailPage';
import { RecordFormPage } from '../pages/RecordFormPage';
import { SettingsPage } from '../pages/SettingsPage';
import { StatusLedgerPage } from '../pages/StatusLedgerPage';
import { CategoryLedgerPage } from '../pages/CategoryLedgerPage';
import { CategoriesPage } from '../pages/CategoriesPage';
import { StatsPage } from '../pages/StatsPage';
import { AppErrorPage } from './AppErrorPage';

function NotFoundPage() {
  return <section><h1>页面不存在</h1><p>地址可能已失效，请返回首页查找好物。</p><Link to="/">返回首页</Link></section>;
}

export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <AppErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'ledgers/:status', element: <StatusLedgerPage /> },
      { path: 'categories/:categoryId', element: <CategoryLedgerPage /> },
      { path: 'assets/new', element: <AssetFormPage /> },
      { path: 'assets/:assetId/edit', element: <AssetFormPage /> },
      { path: 'assets/:assetId', element: <AssetDetailPage /> },
      { path: 'assets/:assetId/records/new', element: <RecordFormPage /> },
      { path: 'assets/:assetId/costs/:recordId/edit', element: <RecordFormPage table="cost" /> },
      { path: 'assets/:assetId/revenues/:recordId/edit', element: <RecordFormPage table="revenue" /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ].map(route => ({ ...route, errorElement: <AppErrorPage /> })),
  },
]);
