import React, { useState } from 'react';
import Modal from './Modal';

export default function ReturnModal({
    isOpen,
    onClose,
    loans,
    onReturnLoan,
    onQuickReturnPC
}) {
    const [activeTab, setActiveTab] = useState('loans'); // 'loans' or 'quick'
    const [searchQuery, setSearchQuery] = useState('');

    // Quick Return State
    const [quickPcModel, setQuickPcModel] = useState('650 G11 Occasion');
    const [includeMouse, setIncludeMouse] = useState(true);
    const [includeCharger, setIncludeCharger] = useState(true);
    const [includeHeadset, setIncludeHeadset] = useState(false);
    const [includeBag, setIncludeBag] = useState(false);

    const filteredLoans = loans.filter(loan =>
        (loan.recipient || loan.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleQuickSubmit = (e) => {
        e.preventDefault();
        onQuickReturnPC(quickPcModel, {
            mouse: includeMouse,
            charger: includeCharger,
            headset: includeHeadset,
            bag: includeBag
        });
        // Reset defaults
        setQuickPcModel('650 G11 Occasion');
        setIncludeMouse(true);
        setIncludeCharger(true);
        setIncludeHeadset(false);
        setIncludeBag(false);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Retour Matériel"
        >
            <div className="segmented-control" style={{ marginBottom: '20px' }}>
                <button
                    className={`segment-btn ${activeTab === 'loans' ? 'active' : ''}`}
                    onClick={() => setActiveTab('loans')}
                >
                    Mes Prêts
                </button>
                <button
                    className={`segment-btn ${activeTab === 'quick' ? 'active' : ''}`}
                    onClick={() => setActiveTab('quick')}
                >
                    Retour PC Rapide
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
                                Aucun prêt en cours trouvé.
                            </p>
                        )}
                        {filteredLoans.map(loan => (
                            <div key={loan.id} className="loan-item" style={{ padding: '10px', borderBottom: '1px solid #f0f0f0' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{loan.recipient || loan.name}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                        {new Date(loan.date).toLocaleDateString()}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                        {loan.items.join(', ')}
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
                <form onSubmit={handleQuickSubmit}>
                    <div className="alert-box" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534', marginBottom: '15px' }}>
                        Ce formulaire ajoute : <br />
                        <strong>+1 {quickPcModel}</strong> + Accessoires cochés.
                    </div>

                    <div className="form-group">
                        <label>Modèle de PC rendu</label>
                        <div className="segmented-control" style={{ marginTop: '5px', marginBottom: '15px' }}>
                            <button
                                type="button"
                                className={`segment-btn ${quickPcModel === '650 G11 Occasion' ? 'active' : ''}`}
                                onClick={() => setQuickPcModel('650 G11 Occasion')}
                            >
                                650 G11 Occ.
                            </button>
                            <button
                                type="button"
                                className={`segment-btn ${quickPcModel === '850 G8/G10 Occasion' ? 'active' : ''}`}
                                onClick={() => setQuickPcModel('850 G8/G10 Occasion')}
                            >
                                850 G8/G10 Occ.
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Accessoires rendus avec le PC :</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={includeMouse}
                                    onChange={e => setIncludeMouse(e.target.checked)}
                                />
                                Souris
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={includeCharger}
                                    onChange={e => setIncludeCharger(e.target.checked)}
                                />
                                Chargeur
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={includeHeadset}
                                    onChange={e => setIncludeHeadset(e.target.checked)}
                                />
                                Casque
                            </label>
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={includeBag}
                                    onChange={e => setIncludeBag(e.target.checked)}
                                />
                                Sacoche
                            </label>
                        </div>
                    </div>

                    <button type="submit" className="btn-add full-width-btn" style={{ background: '#22c55e', marginTop: '20px' }}>
                        Valider le Retour
                    </button>
                </form>
            )}
        </Modal>
    );
}
