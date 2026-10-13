import React, { useMemo, useRef, useState } from 'react';
import { useGlobalScan } from './hooks/useGlobalScan';
import Layout from './components/Layout';
import StockDashboard from './components/StockDashboard';
import HistoryLog from './components/HistoryLog';
import AssignedTab from './components/AssignedTab';
import BottomNav from './components/BottomNav';
import { useInventory } from './hooks/useInventory';
import { getStockStats } from './utils/stockStats';
import { PeopleContext } from './utils/PeopleContext';
import { listPeople } from './utils/person';

import AlertBanner from './components/AlertBanner';
import SyncStatus from './components/SyncStatus';
import RollbackButton from './components/RollbackButton';

function App() {
  const { stock, history, loans, addLoan, handOverLoan, returnAssignedDevice, addWithdrawal, addStock, returnLoan,
        devices, returnFromEmployee, receiveDevices, importInventory, removeUntrackedStock, deleteDevice, undoStack, rollbackTo,
        syncStatus, syncNotice, submitPasscode, dismissSyncNotice, syncNow, syncChoice, resolveSyncChoice } = useInventory();
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'assigned' | 'history'
  const { totalUnits } = useMemo(() => getStockStats(stock), [stock]);
  // Personnes connues, proposées pendant la saisie d'un nom.
  const people = useMemo(() => listPeople(loans, devices), [loans, devices]);

  // Un scan hors d'un champ de saisie est confié à l'onglet affiché :
  // Stock -> fiche du PC ou ajout ; Attribué -> formulaire d'attribution ou recherche.
  const stockRef = useRef(null);
  const assignedRef = useRef(null);
  useGlobalScan((raw) => {
    if (activeTab === 'stock') stockRef.current?.handleScan(raw);
    else if (activeTab === 'assigned') assignedRef.current?.handleScan(raw);
  });

  return (
    <PeopleContext.Provider value={people}>
    <Layout
      totalUnits={totalUnits}
      headerExtra={(
        <div className="header-actions">
          <SyncStatus status={syncStatus} choice={syncChoice} onSubmitCode={submitPasscode} onSyncNow={syncNow} onResolveChoice={resolveSyncChoice} />
          <RollbackButton undoStack={undoStack} onRollback={rollbackTo} />
        </div>
      )}
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
            devices={devices}
            onEmployeeReturn={returnFromEmployee}
            onReceiveDevices={receiveDevices}
            onRemoveUntracked={removeUntrackedStock}
            onDeleteDevice={deleteDevice}
          />
        )}
        {activeTab === 'assigned' && (
          <AssignedTab
            ref={assignedRef}
            loans={loans}
            devices={devices}
            stock={stock}
            onAdd={addLoan}
            onHandOver={handOverLoan}
            onReturnLoan={returnLoan}
            onReturnDevice={returnAssignedDevice}
            onReceiveDevices={receiveDevices}
            onImport={importInventory}
          />
        )}
        {activeTab === 'history' && (
          <HistoryLog history={history} />
        )}
      </div>

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </Layout>
    </PeopleContext.Provider>
  );
}

export default App;
