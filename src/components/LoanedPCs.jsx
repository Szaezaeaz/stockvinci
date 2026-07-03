import React, { useState } from 'react';
import Modal from './Modal';

export default function LoanedPCs({ loans, onAdd, onRemove }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [pcType, setPcType] = useState('PC Neuf');
    const [phoneType, setPhoneType] = useState('Aucun');
    const [searchQuery, setSearchQuery] = useState('');

    const [includeMouse, setIncludeMouse] = useState(true);
    const [includeHeadset, setIncludeHeadset] = useState(true);
    const [includeBag, setIncludeBag] = useState(true);

    const filteredLoans = loans.filter(loan =>
        (loan.name || loan.recipient || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd(name.trim(), pcType, phoneType, {
            mouse: includeMouse,
            headset: includeHeadset,
            bag: includeBag
        });
        setName('');
        setPcType('PC Neuf');
        setPhoneType('Aucun');
        // Reset defaults
        setIncludeMouse(true);
        setIncludeHeadset(true);
        setIncludeBag(true);
        setIsModalOpen(false); // Close modal on success
    };

    return (
        <div className="loan-container">
            <div className="loan-header-actions">
                <h2>PC Prêt</h2>
                <button className="btn-add-trigger" onClick={() => setIsModalOpen(true)}>
                    + Nouveau PC Prêt
                </button>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Ajouter un PC Prêt"
            >
                <form onSubmit={handleSubmit} className="loan-form-modal">
                    <div className="form-group">
                        <label>Nom du collaborateur</label>
                        <input
                            type="text"
                            className="loan-input full-width"
                            placeholder="Ex: Jean Dupont"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label>Type de PC</label>
                        <div className="segmented-control">
                            <button
                                type="button"
                                className={`segment-btn ${pcType === 'PC Neuf' ? 'active' : ''}`}
                                onClick={() => setPcType('PC Neuf')}
                            >
                                Neuf
                            </button>
                            <button
                                type="button"
                                className={`segment-btn ${pcType === 'PC Occasion' ? 'active' : ''}`}
                                onClick={() => setPcType('PC Occasion')}
                            >
                                Occasion
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Accessoires inclus</label>
                        <div style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={includeMouse}
                                    onChange={(e) => setIncludeMouse(e.target.checked)}
                                />
                                Souris
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={includeHeadset}
                                    onChange={(e) => setIncludeHeadset(e.target.checked)}
                                />
                                Casque
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={includeBag}
                                    onChange={(e) => setIncludeBag(e.target.checked)}
                                />
                                Sacoche
                            </label>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Téléphone</label>
                        <div className="segmented-control">
                            <button
                                type="button"
                                className={`segment-btn ${phoneType === 'Aucun' ? 'active' : ''}`}
                                onClick={() => setPhoneType('Aucun')}
                            >
                                Aucun
                            </button>
                            <button
                                type="button"
                                className={`segment-btn ${phoneType === 'Iphone' ? 'active' : ''}`}
                                onClick={() => setPhoneType('Iphone')}
                            >
                                iPhone
                            </button>
                            <button
                                type="button"
                                className={`segment-btn ${phoneType === 'Xcover' ? 'active' : ''}`}
                                onClick={() => setPhoneType('Xcover')}
                            >
                                XCover
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn-add full-width-btn">Confirmer</button>
                </form>
            </Modal>

            <div className="loan-input-group search-group">
                <input
                    type="text"
                    className="loan-input"
                    placeholder="Rechercher un PC..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <ul className="loan-list">
                {filteredLoans.length === 0 && <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>
                    {searchQuery ? 'Aucun résultat.' : 'Aucun prêt en cours.'}
                </p>}

                {filteredLoans.map((loan) => (
                    <li key={loan.id} className="loan-item">
                        <div className="loan-info">
                            <span className="loan-name">{loan.name || loan.recipient}</span>
                            <div className="loan-meta">
                                {loan.items && loan.items.join(' • ')}
                            </div>
                        </div>
                        <button
                            className="btn-circle btn-remove-loan"
                            onClick={() => onRemove(loan.id)}
                            aria-label="Retourner le PC"
                        >
                            ×
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
