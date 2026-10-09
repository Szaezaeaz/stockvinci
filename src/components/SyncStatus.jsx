import React, { useState } from 'react';
import Modal from './Modal';

const LABELS = {
    syncing: 'Synchro…',
    synced: 'Sauvegardé',
    offline: 'Hors-ligne',
    error: 'Erreur synchro',
    'needs-code': 'Code requis'
};

// Pastille d'état de la sauvegarde cloud. Un clic force une synchro, ou
// ouvre la saisie du code d'accès s'il manque / est incorrect.
export default function SyncStatus({ status, onSubmitCode, onSyncNow }) {
    const [isCodeOpen, setIsCodeOpen] = useState(false);
    const [code, setCode] = useState('');

    if (status === 'off') return null;

    const handleClick = () => {
        if (status === 'needs-code') setIsCodeOpen(true);
        else onSyncNow();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!code.trim()) return;
        onSubmitCode(code);
        setCode('');
        setIsCodeOpen(false);
    };

    return (
        <>
            <button type="button" className={`sync-pill sync-${status}`} onClick={handleClick}>
                <span className="sync-dot" />
                {LABELS[status]}
            </button>
            <Modal isOpen={isCodeOpen} onClose={() => setIsCodeOpen(false)} title="Sauvegarde cloud">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Code d'accès</label>
                        <input
                            type="password"
                            className="loan-input"
                            style={{ width: '100%', boxSizing: 'border-box' }}
                            autoComplete="off"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="Code d'accès à la sauvegarde"
                        />
                    </div>
                    <button type="submit" className="btn-add full-width-btn" style={{ marginTop: '20px', color: '#fff', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                        Valider
                    </button>
                </form>
            </Modal>
        </>
    );
}
