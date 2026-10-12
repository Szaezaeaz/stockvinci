import React, { useState } from 'react';
import Modal from './Modal';

const timeOf = (iso) => {
    const date = new Date(iso);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

// Liste des 10 dernières actions (la plus récente d'abord) : on peut revenir à
// l'état d'avant n'importe laquelle, ce qui annule aussi celles qui l'ont suivie.
export default function RollbackButton({ undoStack, onRollback }) {
    const [isOpen, setIsOpen] = useState(false);

    const handleRollback = (index) => {
        const entry = undoStack[index];
        const following = index; // actions plus récentes, annulées en même temps
        let extra = '';
        if (following === 1) extra = ' L\'action suivante sera aussi annulée.';
        else if (following > 1) extra = ` Les ${following} actions suivantes seront aussi annulées.`;
        if (window.confirm(`Revenir à l'état d'avant « ${entry.label} » ?${extra}`)) {
            onRollback(index);
            setIsOpen(false);
        }
    };

    return (
        <>
            <button
                type="button"
                className="rollback-pill"
                disabled={undoStack.length === 0}
                onClick={() => setIsOpen(true)}
            >
                ↶ Rollback{undoStack.length > 0 ? ` (${undoStack.length})` : ''}
            </button>

            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Revenir en arrière">
                <p className="rollback-intro">
                    Choisis l'action à partir de laquelle revenir en arrière : l'appli retrouve l'état d'avant
                    cette action (stock, attributions, historique). Les actions plus récentes sont annulées aussi.
                </p>
                {undoStack.length === 0 && <div className="search-empty">Aucune action à annuler.</div>}
                <ul className="rollback-list">
                    {undoStack.map((entry, index) => (
                        <li key={entry.id} className="rollback-item">
                            <span className="rollback-main">
                                <span className="rollback-label">{entry.label}</span>
                                <span className="rollback-time">{timeOf(entry.at)}{index === 0 ? ' · dernière action' : ''}</span>
                            </span>
                            <button type="button" className="rollback-go" onClick={() => handleRollback(index)}>
                                Revenir ici
                            </button>
                        </li>
                    ))}
                </ul>
            </Modal>
        </>
    );
}
