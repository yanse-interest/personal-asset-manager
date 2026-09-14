import { formatCents } from '../domain/money';
import type { LedgerTotals } from '../domain/ledgers';

export function LedgerSummary({ totals }: { totals: LedgerTotals }) {
  return <div className="dashboard-summary"><div><small>资产</small><strong>{totals.count}</strong></div><div><small>总投入</small><strong>{formatCents(totals.totalCostCents)}</strong></div><div><small>总收益</small><strong>{formatCents(totals.revenueCents)}</strong></div><div><small>净投入</small><strong>{formatCents(totals.netCostCents)}</strong></div></div>;
}
