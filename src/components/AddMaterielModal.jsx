import React, { useState } from 'react';
import Modal from './Modal';
import QuantityStepper from './QuantityStepper';
import { ALL_STOCK_ITEMS } from '../config/items';
import { getMaxStock } from '../config/thresholds';

export default function AddMaterielModal({ isOpen, onClose, onConfirm, stock }) {
    const [quantities, setQuantities] = useState({});

    const setQty = (id, value) => {
        setQuantities(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const itemsToAdd = Object.entries(quantities)
            .filter(([, count]) => count > 0)
            .map(([id, count]) => ({ id, count }));

        if (itemsToAdd.length === 0) {
            alert("Veuillez indiquer une quantité pour au moins un article.");
            return;
        }

        onConfirm(itemsToAdd);
        setQuantities({});
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Ajout Matériel"
        >
            <form onSubmit={handleSubmit} className="global-withdraw-form">
                <div className="form-section" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <label className="section-label" style={{ marginBottom: '12px' }}>QUANTITÉS À AJOUTER AU STOCK</label>
                    <div className="items-grid-selection">
                        {ALL_STOCK_ITEMS.map(item => {
                            const currentStock = stock[item.id] || 0;
                            const maxStock = getMaxStock(item.id);
                            return (
                                <div key={item.id} className="item-add-card">
                                    <div className="item-icon">{item.icon}</div>
                                    <div className="item-name">{item.id}</div>
                                    <div className="item-current-stock">Stock : <strong>{currentStock}</strong> / {maxStock}</div>
                                    <QuantityStepper
                                        value={quantities[item.id] || 0}
                                        onChange={(v) => setQty(item.id, v)}
                                        max={Math.max(0, maxStock - currentStock)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                <button type="submit" className="btn-add full-width-btn" style={{ marginTop: '25px', background: '#22c55e' }}>
                    Valider l'ajout
                </button>
            </form>
        </Modal>
    );
}
