import React, { useState } from 'react';
import Modal from './Modal';

const LABELS = {
    syncing: 'Synchro…',
    synced: 'Sauvegardé',
    offline: 'Hors-ligne',
    error: 'Erreur synchro',
    'needs-choice': 'Choix requis'
};

// Pastille d'état de la sauvegarde cloud. Un clic force une synchro.
const describe = (s) => `${s.units} unités · ${s.loans} attribution(s) · ${s.history} entrée(s) d'historique`;

export default function SyncStatus({ status, choice, onSyncNow, onResolveChoice }) {
    const [choiceHidden, setChoiceHidden] = useState(false);

    if (status === 'off') return null;

    const handleClick = () => {
        if (status === 'needs-choice') setChoiceHidden(false);
        else onSyncNow();
    };

    return (
        <>
            <button type="button" className={`sync-pill sync-${status}`} onClick={handleClick}>
                <span className="sync-dot" />
                {LABELS[status]}
            </button>
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
