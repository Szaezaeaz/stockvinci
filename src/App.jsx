import React, { useState } from 'react';
import Layout from './components/Layout';
import StockDashboard from './components/StockDashboard';
import HistoryLog from './components/HistoryLog';
import LoanedPCs from './components/LoanedPCs';
import { useInventory } from './hooks/useInventory';

import AlertBanner from './components/AlertBanner';

function App() {
  const { stock, history, loans, addLoan, removeLoan, addWithdrawal, addStock, returnLoan, quickReturnPC } = useInventory();
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' or 'loans'

  return (
    <Layout>
      <AlertBanner stock={stock} />
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          Stock
        </button>
        <button
          className={`tab-btn ${activeTab === 'loans' ? 'active' : ''}`}
          onClick={() => setActiveTab('loans')}
        >
          PC Prêt
        </button>
      </div>

      <div style={{ marginTop: '20px' }} className="fade-in" key={activeTab}>
        {activeTab === 'stock' ? (
          <>
            <StockDashboard
              stock={stock}
              onWithdraw={addWithdrawal}
              onAddStock={addStock}
              loans={loans}
              onReturnLoan={returnLoan}
              onQuickReturnPC={quickReturnPC}
            />
            <HistoryLog history={history} />
          </>
        ) : (
          <LoanedPCs loans={loans} onAdd={addLoan} onRemove={removeLoan} />
        )}
      </div>
    </Layout>
  );
}

export default App;
