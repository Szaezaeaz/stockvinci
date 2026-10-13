import React, { useState } from 'react';
import Modal from './Modal';
import EmployeeReturnForm from './EmployeeReturnForm';
import { stockKeyLabel } from '../utils/models';

const MAX_LOANS_SHOWN = 30;

export default function ReturnModal({
    isOpen,
    onClose,
    loans,
    onReturnLoan,
    devices,
    onEmployeeReturn
}) {
    const [activeTab, setActiveTab] = useState('employee'); // 'employee' or 'loans'
    const [searchQuery, setSearchQuery] = useState('');

    // Avec tout le parc, la liste peut dépasser mille personnes : on n'affiche que
    // les premières, la recherche sert à trouver les autres.
    const matchingLoans = loans.filter(loan =>
        (loan.recipient || loan.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    const filteredLoans = matchingLoans.slice(0, MAX_LOANS_SHOWN);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Entrée Matériel"
        >
            <div className="segmented-control" style={{ marginBottom: '20px' }}>
                <button
                    className={`segment-btn ${activeTab === 'employee' ? 'active' : ''}`}
                    onClick={() => setActiveTab('employee')}
                >
                    Retour collaborateur
                </button>
                <button
                    className={`segment-btn ${activeTab === 'loans' ? 'active' : ''}`}
                    onClick={() => setActiveTab('loans')}
                >
                    Matériel attribué
                </button>
            </div>

            {activeTab === 'loans' ? (
                <div className="loan-return-list">
                    <div className="loan-input-group search-group">
                        <input
                            type="text"
                            className="loan-input"
                            placeholder="Chercher un nom..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {filteredLoans.length === 0 && (
                            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>
                                Aucun matériel attribué trouvé.
                            </p>
                        )}
                        {matchingLoans.length > filteredLoans.length && (
                            <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0 0 8px' }}>
                                {filteredLoans.length} affichés sur {matchingLoans.length} : cherche un nom pour trouver les autres.
                            </p>
                        )}
                        {filteredLoans.map(loan => (
                            <div key={loan.id} className="loan-item" style={{ padding: '10px', borderBottom: '1px solid #f0f0f0' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{loan.recipient || loan.name}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                        {new Date(loan.date).toLocaleDateString()}{loan.pickedUpAt ? ' · remis' : ''}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                        {loan.items.map(stockKeyLabel).join(', ')}
                                    </div>
                                </div>
                                <button
                                    className="btn-add"
                                    style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                                    onClick={() => {
                                        if (window.confirm(`Confirmer le retour pour ${loan.recipient || loan.name} ?`)) {
                                            onReturnLoan(loan.id);
                                        }
                                    }}
                                >
                                    Rendre
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <EmployeeReturnForm
                    devices={devices}
                    onSubmit={onEmployeeReturn}
                    onDone={onClose}
                />
            )}
        </Modal>
    );
}
