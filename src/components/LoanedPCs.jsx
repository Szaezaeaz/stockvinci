import React, { useState } from 'react';
import Modal from './Modal';

const PC_TYPE_OPTIONS = [
    '650 G11 Neuf',
    '650 G11 Occasion',
    '850 G8/G10 Occasion',
    'X360 Neuf',
    'Zbook Neuf',
    'Zbook Occasion'
];

const PHONE_TYPE_OPTIONS = ['Aucun', 'iPhone 16e', 'iPhone 17', 'Samsung XCOVER 7', 'Samsung A36'];

export default function LoanedPCs({ loans, onAdd, onRemove }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [pcType, setPcType] = useState('650 G11 Neuf');
    const [phoneType, setPhoneType] = useState('Aucun');
    const [searchQuery, setSearchQuery] = useState('');

    const [includeMouse, setIncludeMouse] = useState(true);
    const [includeHeadset, setIncludeHeadset] = useState(false);
    const [includeBag, setIncludeBag] = useState(true);
    const [includeBackpack, setIncludeBackpack] = useState(false);
    const [includeScreen, setIncludeScreen] = useState(false);
    const [includeDock, setIncludeDock] = useState(false);
    const [includeKeyboard, setIncludeKeyboard] = useState(false);

    const filteredLoans = loans.filter(loan =>
        (loan.name || loan.recipient || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const resetAccessories = () => {
        setIncludeMouse(true);
        setIncludeHeadset(false);
        setIncludeBag(true);
        setIncludeBackpack(false);
        setIncludeScreen(false);
        setIncludeDock(false);
        setIncludeKeyboard(false);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd(name.trim(), pcType, phoneType, {
            mouse: includeMouse,
            headset: includeHeadset,
            bag: includeBag,
            backpack: includeBackpack,
            screen: includeScreen,
            dock: includeDock,
            keyboard: includeKeyboard
        });
        setName('');
        setPcType('650 G11 Neuf');
        setPhoneType('Aucun');
        resetAccessories();
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
                        <select
                            className="loan-input full-width"
                            value={pcType}
                            onChange={(e) => setPcType(e.target.value)}
                        >
                            {PC_TYPE_OPTIONS.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Accessoires inclus</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 15px', marginTop: '5px' }}>
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
                                    checked={includeBag}
                                    onChange={(e) => setIncludeBag(e.target.checked)}
                                />
                                Sacoche
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={includeBackpack}
                                    onChange={(e) => setIncludeBackpack(e.target.checked)}
                                />
                                Sac à Dos
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
                                    checked={includeScreen}
                                    onChange={(e) => setIncludeScreen(e.target.checked)}
                                />
                                Écran
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={includeDock}
                                    onChange={(e) => setIncludeDock(e.target.checked)}
                                />
                                Dock
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={includeKeyboard}
                                    onChange={(e) => setIncludeKeyboard(e.target.checked)}
                                />
                                Clavier
                            </label>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Téléphone</label>
                        <select
                            className="loan-input full-width"
                            value={phoneType}
                            onChange={(e) => setPhoneType(e.target.value)}
                        >
                            {PHONE_TYPE_OPTIONS.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
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
