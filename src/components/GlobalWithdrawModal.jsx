import React, { useState } from 'react';
import Modal from './Modal';

const ITEMS_TO_DISPLAY = [
    { id: 'Souris', icon: '🖱️' },
    { id: 'Clavier', icon: '⌨️' },
    { id: 'Casque', icon: '🎧' },
    { id: 'Sacoche', icon: '💼' },
    { id: 'Chargeur', icon: '🔌' },
    { id: 'Dock', icon: '⚙️' },
    { id: 'Iphone', icon: '📱' },
    { id: 'Xcover', icon: '📱' },
    { id: 'PC Neuf', icon: '💻' },
    { id: 'PC Occasion', icon: '💻' },
];

export default function GlobalWithdrawModal({ isOpen, onClose, onConfirm, stock }) {
    const [recipient, setRecipient] = useState('');
    const [type, setType] = useState('pret'); // 'don' or 'pret'
    const [selectedItems, setSelectedItems] = useState({}); // { 'Souris': true, ... }

    const toggleSelection = (itemId) => {
        const currentStock = stock[itemId] || 0;
        if (currentStock === 0) return; // Cannot select out of stock

        setSelectedItems(prev => {
            const isSelected = !!prev[itemId];
            if (isSelected) {
                const { [itemId]: _, ...rest } = prev;
                return rest;
            } else {
                return { ...prev, [itemId]: 1 }; // Default to 1
            }
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const itemsToWithdraw = Object.entries(selectedItems)
            .map(([id, count]) => ({ id, count })); // count is always 1 for now

        if (itemsToWithdraw.length === 0) {
            alert("Veuillez sélectionner au moins un article.");
            return;
        }

        onConfirm(recipient.trim() || 'Anonyme', type, itemsToWithdraw);

        setRecipient('');
        setType('pret');
        setSelectedItems({});
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Nouveau Retrait"
        >
            <form onSubmit={handleSubmit} className="global-withdraw-form">

                <div className="form-section">
                    <label className="section-label">BÉNÉFICIAIRE</label>
                    <input
                        type="text"
                        className="loan-input full-width"
                        placeholder="Nom du collaborateur"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        autoFocus
                        required
                    />
                </div>

                <div className="form-section" style={{ marginTop: '20px' }}>
                    <label className="section-label">TYPE DE MOUVEMENT</label>
                    <div className="type-toggle-group">
                        <button
                            type="button"
                            className={`type-btn ${type === 'pret' ? 'active' : ''}`}
                            onClick={() => setType('pret')}
                        >
                            Prêt Temporaire
                        </button>
                        <button
                            type="button"
                            className={`type-btn ${type === 'don' ? 'active' : ''}`}
                            onClick={() => setType('don')}
                        >
                            Don (Définitif)
                        </button>
                    </div>
                </div>

                <div className="form-section" style={{ marginTop: '25px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <label className="section-label" style={{ marginBottom: '12px' }}>SÉLECTION DU MATÉRIEL</label>
                    <div className="items-grid-selection">
                        {ITEMS_TO_DISPLAY.map(item => {
                            const isSelected = !!selectedItems[item.id];
                            const available = stock[item.id] || 0;
                            const isOutOfStock = available === 0;

                            return (
                                <div
                                    key={item.id}
                                    className={`item-select-card ${isSelected ? 'selected' : ''} ${isOutOfStock ? 'disabled' : ''}`}
                                    onClick={() => toggleSelection(item.id)}
                                >
                                    <div className="item-icon">{item.icon}</div>
                                    <div className="item-name">{item.id}</div>
                                    <div className="stock-hint">Stock : {available}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <button type="submit" className="btn-add full-width-btn" style={{ marginTop: '25px' }}>
                    Valider le retrait
                </button>
            </form>
        </Modal>
    );
}
