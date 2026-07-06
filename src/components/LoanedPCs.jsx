import React, { useState } from 'react';
import Modal from './Modal';

export default function LoanedPCs({ loans, onAdd, onRemove }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [pcType, setPcType] = useState('650 G11 Neuf');
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
        setPcType('650 G11 Neuf');
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
                                className={`segment-btn ${pcType === '650 G11 Neuf' ? 'active' : ''}`}
                                onClick={() => setPcType('650 G11 Neuf')}
                            >
                                650 G11 Neuf
                            </button>
                            <button
                                type="button"
                                className={`segment-btn ${pcType === '650 G11 Occasion' ? 'active' : ''}`}
                                onClick={() => setPcType('650 G11 Occasion')}
                            >
                                650 G11 Occ.
                            </button>
                            <button
                                type="button"
                                className={`segment-btn ${pcType === '850 G8/G10 Occasion' ? 'active' : ''}`}
                                onClick={() => setPcType('850 G8/G10 Occasion')}
                            >
                                850 G8/G10 Occ.
                            </button>
                            <button
                                type="button"
                                className={`segment-btn ${pcType === 'X360 Neuf' ? 'active' : ''}`}
                                onClick={() => setPcType('X360 Neuf')}
                            >
                                X360 Neuf
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
                                className={`segment-btn ${phoneType === 'iPhone 16e' ? 'active' : ''}`}
                                onClick={() => setPhoneType('iPhone 16e')}
                            >
                                iPhone 16e
                            </button>
                            <button
                                type="button"
                                className={`segment-btn ${phoneType === 'Samsung XCOVER 7' ? 'active' : ''}`}
                                onClick={() => setPhoneType('Samsung XCOVER 7')}
                            >
                                XCOVER 7
                            </button>
                            <button
                                type="button"
                                className={`segment-btn ${phoneType === 'Samsung A36' ? 'active' : ''}`}
                                onClick={() => setPhoneType('Samsung A36')}
                            >
                                A36
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
