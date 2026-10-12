import React, { useMemo, useRef, useState } from 'react';
import { useGlobalScan } from './hooks/useGlobalScan';
import Layout from './components/Layout';
import StockDashboard from './components/StockDashboard';
import HistoryLog from './components/HistoryLog';
import LoanedPCs from './components/LoanedPCs';
import AssignedMaterial from './components/AssignedMaterial';
import BottomNav from './components/BottomNav';
import { useInventory } from './hooks/useInventory';
import { getStockStats } from './utils/stockStats';

import AlertBanner from './components/AlertBanner';
import SyncStatus from './components/SyncStatus';

function App() {
  const { stock, history, loans, addLoan, handOverLoan, returnAssignedDevice, addWithdrawal, addStock, returnLoan, quickReturnPC,
        devices, returnFromEmployee, receiveDevices, removeUntrackedStock, deleteDevice,
        syncStatus, syncNotice, submitPasscode, dismissSyncNotice, syncNow, syncChoice, resolveSyncChoice } = useInventory();
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'loans' | 'assigned' | 'history'
  const { totalUnits } = useMemo(() => getStockStats(stock), [stock]);

  // Un scan hors d'un champ de saisie est confié à l'onglet affiché :
  // Stock -> fiche du PC ou ajout ; À récupérer -> formulaire avec le PC choisi.
  const stockRef = useRef(null);
  const loansRef = useRef(null);
  const assignedRef = useRef(null);
  useGlobalScan((raw) => {
    if (activeTab === 'stock') stockRef.current?.handleScan(raw);
    else if (activeTab === 'loans') loansRef.current?.handleScan(raw);
    else if (activeTab === 'assigned') assignedRef.current?.handleScan(raw);
  });

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
            ref={stockRef}
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
            onDeleteDevice={deleteDevice}
          />
        )}
        {activeTab === 'loans' && (
          <LoanedPCs ref={loansRef} loans={loans} onAdd={addLoan} onHandOver={handOverLoan} devices={devices} onReceiveDevices={receiveDevices} />
        )}
        {activeTab === 'assigned' && (
          <AssignedMaterial
            ref={assignedRef}
            loans={loans}
            devices={devices}
            onReturnLoan={returnLoan}
            onReturnDevice={returnAssignedDevice}
          />
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
