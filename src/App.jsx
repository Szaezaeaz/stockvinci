import React, { useMemo, useState } from 'react';
import Layout from './components/Layout';
import StockDashboard from './components/StockDashboard';
import HistoryLog from './components/HistoryLog';
import LoanedPCs from './components/LoanedPCs';
import BottomNav from './components/BottomNav';
import { useInventory } from './hooks/useInventory';
import { getStockStats } from './utils/stockStats';

import AlertBanner from './components/AlertBanner';
import SyncStatus from './components/SyncStatus';

function App() {
  const { stock, history, loans, addLoan, removeLoan, addWithdrawal, addStock, returnLoan, quickReturnPC,
        devices, returnFromEmployee, receiveDevices, removeUntrackedStock,
        syncStatus, syncNotice, submitPasscode, dismissSyncNotice, syncNow, syncChoice, resolveSyncChoice } = useInventory();
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'loans' | 'history'
  const { totalUnits } = useMemo(() => getStockStats(stock), [stock]);

  return (
    <Layout
      totalUnits={totalUnits}
      headerExtra={<SyncStatus status={syncStatus} choice={syncChoice} onSubmitCode={submitPasscode} onSyncNow={syncNow} onResolveChoice={resolveSyncChoice} />}
    >
      {syncNotice && (
        <div className="sync-notice">
          <span>{syncNotice}</span>
          <button type="button" onClick={dismissSyncNotice} aria-label="Fermer">&times;</button>
        </div>
      )}

      <AlertBanner stock={stock} />

      <div className="fade-in" key={activeTab}>
        {activeTab === 'stock' && (
          <StockDashboard
            stock={stock}
            onWithdraw={addWithdrawal}
            onAddStock={addStock}
            loans={loans}
            onReturnLoan={returnLoan}
            onQuickReturnPC={quickReturnPC}
            devices={devices}
            onEmployeeReturn={returnFromEmployee}
            onReceiveDevices={receiveDevices}
            onRemoveUntracked={removeUntrackedStock}
          />
        )}
        {activeTab === 'loans' && (
          <LoanedPCs loans={loans} onAdd={addLoan} onRemove={removeLoan} devices={devices} />
        )}
        {activeTab === 'history' && (
          <HistoryLog history={history} />
        )}
      </div>

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </Layout>
  );
}

export default App;
