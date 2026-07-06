import React, { useMemo, useState } from 'react';
import Layout from './components/Layout';
import StockDashboard from './components/StockDashboard';
import HistoryLog from './components/HistoryLog';
import LoanedPCs from './components/LoanedPCs';
import BottomNav from './components/BottomNav';
import { useInventory } from './hooks/useInventory';
import { getStockStats } from './utils/stockStats';

import AlertBanner from './components/AlertBanner';

function App() {
  const { stock, history, loans, addLoan, removeLoan, addWithdrawal, addStock, returnLoan, quickReturnPC } = useInventory();
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'loans' | 'history'
  const { totalUnits } = useMemo(() => getStockStats(stock), [stock]);

  return (
    <Layout totalUnits={totalUnits}>
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
          />
        )}
        {activeTab === 'loans' && (
          <LoanedPCs loans={loans} onAdd={addLoan} onRemove={removeLoan} />
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
