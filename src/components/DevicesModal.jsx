import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { errorMessage, listDevices, updateDevice } from '../services/auth';

const dateOf = (value) => (value ? new Date(value).toLocaleDateString() : 'jamais');

// Appareils autorisés à se connecter (administrateurs). Une demande s'approuve en
// vérifiant que le code est bien celui affiché sur l'appareil, devant soi.
export default function DevicesModal({ onClose }) {
    const [devices, setDevices] = useState(null);
    const [currentId, setCurrentId] = useState(null);
    const [error, setError] = useState('');

    const load = (result) => {
        if (result.status === 200) {
            setDevices(result.body.devices);
            setCurrentId(result.body.currentId);
            setError('');
        } else {
            setError(errorMessage(result));
        }
    };

    useEffect(() => {
        listDevices().then(load);
    }, []);

    const approve = (device) => {
        if (window.confirm(`Le code affiché sur l’appareil est bien ${device.code} ? Il pourra alors tenter une connexion.`)) {
            updateDevice('approve', device.id).then(load);
        }
    };
    const remove = (device) => {
        const message = device.status === 'pending'
            ? `Refuser la demande de « ${device.label} » ?`
            : `Retirer l’autorisation de « ${device.label} » ? Toute session ouverte dessus sera coupée.`;
        if (window.confirm(message)) updateDevice('remove', device.id).then(load);
    };

    const pending = (devices || []).filter(device => device.status === 'pending');
    const approved = (devices || []).filter(device => device.status === 'approved');

    return (
        <Modal isOpen onClose={onClose} title="Appareils autorisés">
            {error && <p className="login-error">{error}</p>}
            {!devices && !error && <p className="search-empty">Chargement…</p>}

            {pending.length > 0 && <label className="section-label">DEMANDES EN ATTENTE</label>}
            <ul className="team-list">
                {pending.map(device => (
                    <li key={device.id} className="team-item">
                        <div className="team-main">
                            <span className="team-name">{device.label}</span>
                            <span className="team-sub">Code : <strong>{device.code}</strong> · demandé le {dateOf(device.createdAt)}</span>
                        </div>
                        <div className="team-actions">
                            <button type="button" className="assignment-return" onClick={() => approve(device)}>Approuver</button>
                            <button type="button" className="assignment-return" onClick={() => remove(device)}>Refuser</button>
                        </div>
                    </li>
                ))}
            </ul>

            {approved.length > 0 && <label className="section-label">APPAREILS AUTORISÉS</label>}
            <ul className="team-list">
                {approved.map(device => (
                    <li key={device.id} className="team-item">
                        <div className="team-main">
                            <span className="team-name">{device.label}{device.id === currentId ? ' (cet appareil)' : ''}</span>
                            <span className="team-sub">Dernière connexion : {dateOf(device.lastSeenAt)}{device.approvedBy ? ` · approuvé par ${device.approvedBy}` : ''}</span>
                        </div>
                        {device.id !== currentId && (
                            <div className="team-actions">
                                <button type="button" className="assignment-return" onClick={() => remove(device)}>Retirer</button>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </Modal>
    );
}
