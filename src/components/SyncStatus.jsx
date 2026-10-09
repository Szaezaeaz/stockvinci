import React, { useState } from 'react';
import Modal from './Modal';

const LABELS = {
    syncing: 'Synchro…',
    synced: 'Sauvegardé',
    offline: 'Hors-ligne',
    error: 'Erreur synchro',
    'needs-code': 'Code requis',
    'needs-choice': 'Choix requis'
};

// Pastille d'état de la sauvegarde cloud. Un clic force une synchro, ou
// ouvre la saisie du code d'accès s'il manque / est incorrect.
const describe = (s) => `${s.units} unités · ${s.loans} à récupérer · ${s.history} entrée(s) d'historique`;

export default function SyncStatus({ status, choice, onSubmitCode, onSyncNow, onResolveChoice }) {
    const [isCodeOpen, setIsCodeOpen] = useState(false);
    const [code, setCode] = useState('');
    const [choiceHidden, setChoiceHidden] = useState(false);

    if (status === 'off') return null;

    const handleClick = () => {
        if (status === 'needs-code') setIsCodeOpen(true);
        else if (status === 'needs-choice') setChoiceHidden(false);
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
            <Modal isOpen={Boolean(choice) && !choiceHidden} onClose={() => setChoiceHidden(true)} title="Quelles données garder ?">
                {choice && (
                    <div>
                        <p style={{ marginTop: 0, color: '#475569' }}>
                            Le cloud contient déjà des données et cet appareil a les siennes.
                            Choisis celles à conserver : les autres seront remplacées.
                        </p>
                        <div className="sync-choice-box">
                            <strong>Cloud</strong>
                            <span>{describe(choice.cloud)}</span>
                        </div>
                        <div className="sync-choice-box">
                            <strong>Cet appareil</strong>
                            <span>{describe(choice.local)}</span>
                        </div>
                        <button
                            type="button"
                            className="btn-add full-width-btn"
                            style={{ marginTop: '16px', color: '#fff', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
                            onClick={() => {
                                if (window.confirm('Le cloud sera remplacé par les données de CET appareil. Continuer ?')) onResolveChoice('local');
                            }}
                        >
                            Garder cet appareil (remplace le cloud)
                        </button>
                        <button
                            type="button"
                            className="btn-add full-width-btn"
                            style={{ marginTop: '10px' }}
                            onClick={() => {
                                if (window.confirm('Les données de CET appareil seront remplacées par celles du cloud. Continuer ?')) onResolveChoice('cloud');
                            }}
                        >
                            Garder le cloud (remplace cet appareil)
                        </button>
                    </div>
                )}
            </Modal>
        </>
    );
}
