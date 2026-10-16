import React, { useState } from 'react';
import Modal from './Modal';
import PersonNameFields from './PersonNameFields';
import NoteField from './NoteField';
import { useNewPersonCheck } from './NewPersonCheck';
import { WITHDRAW_NOTE_PRESETS } from '../config/notePresets';
import { SECONDARY_ITEMS } from '../config/secondaryItems';
import { fullName } from '../utils/person';

export default function GlobalWithdrawModal({ isOpen, onClose, onConfirm, stock }) {
    const [lastName, setLastName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [type, setType] = useState('pret'); // 'don' or 'pret'
    const [selectedItems, setSelectedItems] = useState({}); // { 'Souris': true, ... }
    const [note, setNote] = useState('');
    const { confirmPerson, dialog: newPersonDialog } = useNewPersonCheck();

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

        // Personne absente de l'appli : confirmation d'abord (faute de frappe ?).
        confirmPerson(fullName(lastName, firstName), (name) => {
            onConfirm(name || 'Anonyme', type, itemsToWithdraw, note);

            setLastName('');
            setFirstName('');
            setType('pret');
            setSelectedItems({});
            setNote('');
            onClose();
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Sortie accessoires"
        >
            {newPersonDialog}
            <form onSubmit={handleSubmit} className="global-withdraw-form">

                <div className="form-section">
                    <label className="section-label">BÉNÉFICIAIRE</label>
                    <PersonNameFields
                        last={lastName}
                        first={firstName}
                        onLastChange={setLastName}
                        onFirstChange={setFirstName}
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
                        {SECONDARY_ITEMS.map(item => {
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

                <div style={{ marginTop: '20px' }}>
                    <NoteField value={note} onChange={setNote} presets={WITHDRAW_NOTE_PRESETS} />
                </div>

                <button type="submit" className="btn-add full-width-btn" style={{ marginTop: '10px' }}>
                    Valider le retrait
                </button>
            </form>
        </Modal>
    );
}
