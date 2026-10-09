import React, { useState } from 'react';
import Modal from './Modal';
import SearchBar from './SearchBar';
import { matchesQuery } from '../utils/search';

const dateOf = (value) => (value ? new Date(value).toLocaleDateString() : '');

function statusLabel(device) {
    return device.status === 'assigned' ? `Attribué à ${device.holder || '?'}` : 'En stock';
}

// Liste des appareils (n° de série) d'un modèle, avec leur état : en stock ou
// attribué à une personne, plus l'historique de leurs mouvements.
export default function DeviceListModal({ model, devices, stock, onClose, onRemoveUntracked }) {
    const [query, setQuery] = useState('');
    const [openSerial, setOpenSerial] = useState(null);

    const all = Object.values(devices || {})
        .filter(device => device.model === model)
        .sort((a, b) => new Date(b.events?.[0]?.date || 0) - new Date(a.events?.[0]?.date || 0));
    const visible = all.filter(device =>
        matchesQuery(query, [device.serial, device.holder || '', statusLabel(device), device.modelName || '', device.productId || ''])
    );

    const inStock = all.filter(device => device.status === 'stock').length;
    const assigned = all.length - inStock;
    const untracked = (stock?.[model] || 0) - inStock;

    const handleRemoveUntracked = () => {
        if (window.confirm(`Retirer du stock les ${untracked} ${model} sans n° de série ? Le stock affiché passera à ${inStock}.`)) {
            onRemoveUntracked(model);
        }
    };

    return (
        <Modal isOpen={Boolean(model)} onClose={onClose} title={model || ''}>
            <div className="device-summary">
                <span className="device-chip device-chip-stock">{inStock} en stock</span>
                <span className="device-chip device-chip-assigned">{assigned} attribué{assigned > 1 ? 's' : ''}</span>
            </div>

            {untracked > 0 && (
                <div className="device-warning">
                    <span>{untracked} unité{untracked > 1 ? 's' : ''} dans le stock sans n° de série.</span>
                    <button type="button" onClick={handleRemoveUntracked}>Retirer du stock</button>
                </div>
            )}
            {untracked < 0 && (
                <div className="device-warning">
                    Écart : {-untracked} appareil{-untracked > 1 ? 's' : ''} scanné{-untracked > 1 ? 's' : ''} en stock de plus que le stock affiché.
                </div>
            )}

            <SearchBar value={query} onChange={setQuery} placeholder="Rechercher un n° de série ou une personne…" />

            {all.length === 0 && <div className="search-empty">Aucun appareil scanné pour ce modèle.</div>}
            {all.length > 0 && visible.length === 0 && <div className="search-empty">Aucun appareil trouvé.</div>}

            <ul className="device-list">
                {visible.map(device => {
                    const last = device.events?.[0];
                    const open = openSerial === device.serial;
                    return (
                        <li key={device.serial} className="device-item">
                            <button type="button" className="device-row" onClick={() => setOpenSerial(open ? null : device.serial)}>
                                <span className="device-main">
                                    <span className="device-serial">{device.serial}</span>
                                    <span className="device-sub">
                                        {last ? `${last.action}${last.person ? ` · ${last.person}` : ''} · ${dateOf(last.date)}` : ''}
                                    </span>
                                </span>
                                <span className={`device-badge ${device.status === 'assigned' ? 'device-badge-assigned' : 'device-badge-stock'}`}>
                                    {statusLabel(device)}
                                </span>
                            </button>
                            {open && (
                                <ul className="device-events">
                                    {device.modelName && <li>Modèle : {device.modelName}{device.productId ? ` (${device.productId})` : ''}</li>}
                                    {(device.events || []).map((event, index) => (
                                        <li key={index}>
                                            {dateOf(event.date)} · {event.action}{event.person ? ` · ${event.person}` : ''}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    );
                })}
            </ul>
        </Modal>
    );
}
