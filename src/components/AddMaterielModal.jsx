import React, { useState } from 'react';
import Modal from './Modal';
import QuantityStepper from './QuantityStepper';
import SearchBar from './SearchBar';
import { matchesQuery } from '../utils/search';
import { ALL_STOCK_ITEMS } from '../config/items';
import { getLowStockThreshold, getMaxStock, hasStockLimits } from '../config/thresholds';

export default function AddMaterielModal({ isOpen, onClose, onConfirm, stock }) {
    const [quantities, setQuantities] = useState({});
    const [query, setQuery] = useState('');
    const visibleItems = ALL_STOCK_ITEMS.filter(item => matchesQuery(query, [item.id]));

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
        setQuery('');
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => { setQuery(''); onClose(); }}
            title="Ajout Matériel"
        >
            <form onSubmit={handleSubmit} className="global-withdraw-form">
                <div className="form-section" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <label className="section-label" style={{ marginBottom: '12px' }}>QUANTITÉS À AJOUTER AU STOCK</label>
                    <SearchBar value={query} onChange={setQuery} placeholder="Rechercher un article…" />
                    {visibleItems.length === 0 && <div className="search-empty">Aucun article trouvé.</div>}
                    <div className="items-grid-selection">
                        {visibleItems.map(item => {
                            const currentStock = stock[item.id] || 0;
                            const limited = hasStockLimits(item.id);
                            const maxStock = getMaxStock(item.id);
                            const threshold = getLowStockThreshold(item.id);
                            const inAlert = threshold > 0 && currentStock < threshold;
                            return (
                                <div key={item.id} className={`item-add-card${inAlert ? ' item-add-card-alert' : ''}`}>
                                    <div className="item-icon">{item.icon}</div>
                                    <div className="item-name">{item.id}</div>
                                    <div className="item-current-stock">
                                        Stock : <strong>{currentStock}</strong>{limited && <> / {maxStock}</>}
                                    </div>
                                    <QuantityStepper
                                        value={quantities[item.id] || 0}
                                        onChange={(v) => setQty(item.id, v)}
                                        max={limited ? Math.max(0, maxStock - currentStock) : Infinity}
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
