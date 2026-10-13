import React, { useState } from 'react';
import Modal from './Modal';
import SearchBar from './SearchBar';
import { matchesQuery } from '../utils/search';
import { stockKeyLabel } from '../utils/models';

// Un modèle peut compter des centaines d'appareils : on en affiche une page à la fois.
const PAGE_SIZE = 50;

const dateOf = (value) => (value ? new Date(value).toLocaleDateString() : '');

function statusLabel(device) {
    return device.status === 'assigned' ? `Attribué à ${device.holder || '?'}` : 'En stock';
}

// Liste des appareils (n° de série) d'un modèle, avec leur état : en stock ou
// attribué à une personne, plus l'historique de leurs mouvements.
// initialSerial : appareil dont la fiche s'ouvre dès l'affichage (après un scan).
export default function DeviceListModal({ model, devices, stock, onClose, onRemoveUntracked, onDeleteDevice, initialSerial }) {
    const [query, setQuery] = useState('');
    const [openSerial, setOpenSerial] = useState(initialSerial || null);
    const [limit, setLimit] = useState(PAGE_SIZE);

    const all = Object.values(devices || {})
        .filter(device => device.model === model)
        .sort((a, b) => new Date(b.events?.[0]?.date || 0) - new Date(a.events?.[0]?.date || 0));
    const visible = all.filter(device =>
        matchesQuery(query, [device.serial, device.holder || '', statusLabel(device), device.exactModel || '', device.modelName || '', device.productId || ''])
    );

    // L'appareil ouvert d'office (après un scan) reste affiché même au-delà de la première page.
    const shown = visible.filter((device, index) => index < limit || device.serial === openSerial);

    const inStock = all.filter(device => device.status === 'stock').length;
    const assigned = all.length - inStock;
    const untracked = (stock?.[model] || 0) - inStock;

    const handleRemoveUntracked = () => {
        if (window.confirm(`Retirer du stock les ${untracked} ${stockKeyLabel(model)} sans n° de série ? Le stock affiché passera à ${inStock}.`)) {
            onRemoveUntracked(model);
        }
    };

    const handleDelete = (device) => {
        const message = device.status === 'assigned'
            ? `${device.serial} est attribué à ${device.holder || '?'}. Supprimer sa fiche ? Le stock ne change pas.`
            : `Supprimer ${device.serial} ? Le stock de ${stockKeyLabel(model)} passera de ${stock?.[model] || 0} à ${Math.max(0, (stock?.[model] || 0) - 1)}.`;
        if (window.confirm(message)) {
            onDeleteDevice(device.serial);
            setOpenSerial(null);
        }
    };

    return (
        <Modal isOpen={Boolean(model)} onClose={onClose} title={stockKeyLabel(model)}>
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

            <SearchBar value={query} onChange={(value) => { setQuery(value); setLimit(PAGE_SIZE); }} placeholder="Rechercher un n° de série ou une personne…" />

            {all.length === 0 && <div className="search-empty">Aucun appareil scanné pour ce modèle.</div>}
            {all.length > 0 && visible.length === 0 && <div className="search-empty">Aucun appareil trouvé.</div>}

            <ul className="device-list">
                {shown.map(device => {
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
                                    {device.exactModel && <li>Modèle précis : {device.exactModel}</li>}
                                    {device.modelName && <li>QR code : {device.modelName}{device.productId ? ` (${device.productId})` : ''}</li>}
                                    {(device.events || []).map((event, index) => (
                                        <li key={index}>
                                            {dateOf(event.date)} · {event.action}{event.person ? ` · ${event.person}` : ''}
                                        </li>
                                    ))}
                                    <li className="device-delete-row">
                                        <button type="button" className="device-delete" onClick={() => handleDelete(device)}>
                                            Supprimer cet appareil
                                        </button>
                                    </li>
                                </ul>
                            )}
                        </li>
                    );
                })}
            </ul>

            {visible.length > shown.length && (
                <button type="button" className="show-more" onClick={() => setLimit(limit + PAGE_SIZE)}>
                    Afficher plus ({visible.length - shown.length} restants)
                </button>
            )}
        </Modal>
    );
}
