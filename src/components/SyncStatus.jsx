import React, { useState } from 'react';
import Modal from './Modal';

const LABELS = {
    syncing: 'Synchro…',
    synced: 'Sauvegardé',
    offline: 'Hors-ligne',
    error: 'Erreur synchro',
    'needs-choice': 'Choix requis'
};

// Mot à taper pour remplacer les données de toute l'équipe par celles de l'appareil.
const CONFIRM_WORD = 'REMPLACER';

const describe = (s) => `${s.units} unités · ${s.loans} attribution(s) · ${s.history} entrée(s) d'historique`;

// Pastille d'état de la sauvegarde cloud. Un clic force une synchro.
// Premier lancement sur un appareil qui a déjà ses propres données : on demande
// lesquelles garder. "Garder le cloud" est le choix normal, en grand ; remplacer le
// cloud par l'appareil écrase les données de toute l'équipe, il faut donc lire
// l'avertissement et taper REMPLACER.
export default function SyncStatus({ status, choice, onSyncNow, onResolveChoice }) {
    const [choiceHidden, setChoiceHidden] = useState(false);
    const [confirmingLocal, setConfirmingLocal] = useState(false);
    const [typed, setTyped] = useState('');

    if (status === 'off') return null;

    const handleClick = () => {
        if (status === 'needs-choice') setChoiceHidden(false);
        else onSyncNow();
    };

    const closeChoice = () => {
        setChoiceHidden(true);
        setConfirmingLocal(false);
        setTyped('');
    };

    return (
        <>
            <button type="button" className={`sync-pill sync-${status}`} onClick={handleClick}>
                <span className="sync-dot" />
                {LABELS[status]}
            </button>
            <Modal isOpen={Boolean(choice) && !choiceHidden} onClose={closeChoice} title="Quelles données garder ?">
                {choice && !confirmingLocal && (
                    <div>
                        <p style={{ marginTop: 0, color: '#475569' }}>
                            Cet appareil a ses propres données, différentes de celles de l’équipe (le cloud).
                            Dans presque tous les cas, il faut <strong>garder le cloud</strong>.
                        </p>
                        <div className="sync-choice-box">
                            <strong>Cloud (données de l’équipe)</strong>
                            <span>{describe(choice.cloud)}</span>
                        </div>
                        <div className="sync-choice-box">
                            <strong>Cet appareil</strong>
                            <span>{describe(choice.local)}</span>
                        </div>
                        <button type="button" className="sync-keep-cloud" onClick={() => onResolveChoice('cloud')}>
                            Garder le cloud
                            <small>Recommandé · cet appareil reprend les données de l’équipe</small>
                        </button>
                        <button type="button" className="sync-keep-local" onClick={() => setConfirmingLocal(true)}>
                            Remplacer le cloud par cet appareil…
                        </button>
                    </div>
                )}
                {choice && confirmingLocal && (
                    <div>
                        <div className="sync-danger">
                            <strong>⚠️ Attention : action risquée</strong>
                            <p>
                                Les données de <strong>toute l’équipe</strong> ({describe(choice.cloud)}) seront
                                remplacées sur <strong>toutes les tablettes</strong> par celles de cet appareil
                                ({describe(choice.local)}).
                            </p>
                            <p>
                                Tout ce qui a été fait sur les autres tablettes et qui n’est pas sur celle-ci
                                (attributions, retours, réceptions, historique) disparaîtra pour tout le monde.
                                Seul un administrateur pourra revenir en arrière avec les sauvegardes du serveur.
                            </p>
                        </div>
                        <label className="sync-danger-label">Pour confirmer, tape {CONFIRM_WORD} :</label>
                        <input
                            type="text"
                            className="loan-input sync-danger-input"
                            value={typed}
                            onChange={(e) => setTyped(e.target.value.toUpperCase())}
                            autoComplete="off"
                            autoCapitalize="characters"
                            placeholder={CONFIRM_WORD}
                        />
                        <button
                            type="button"
                            className="sync-danger-go"
                            disabled={typed.trim() !== CONFIRM_WORD}
                            onClick={() => { onResolveChoice('local'); setConfirmingLocal(false); setTyped(''); }}
                        >
                            Remplacer les données de toute l’équipe
                        </button>
                        <button type="button" className="sync-keep-cloud sync-keep-cloud-small" onClick={() => { setConfirmingLocal(false); setTyped(''); }}>
                            ← Annuler, revenir au choix
                        </button>
                    </div>
                )}
            </Modal>
        </>
    );
}
