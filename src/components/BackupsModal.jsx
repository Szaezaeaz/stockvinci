import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { errorMessage, listBackups, restoreBackup } from '../services/auth';

const KIND_LABELS = {
    auto: 'Automatique',
    jour: 'Début de journée',
    restauration: 'Avant une restauration'
};

const when = (at) => new Date(at).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// Sauvegardes de l'inventaire gardées par le serveur (administrateurs) : au plus une
// par quart d'heure d'activité (3 jours), une par jour (31 jours). Restaurer remplace
// l'inventaire de toutes les tablettes (l'état actuel est d'abord sauvegardé).
export default function BackupsModal({ onClose, onRestored }) {
    const [backups, setBackups] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        listBackups().then(result => {
            if (result.status === 200) setBackups(result.body.backups);
            else setError(errorMessage(result));
        });
    }, []);

    const restore = async (backup) => {
        if (!window.confirm(`Remettre l’inventaire tel qu’il était le ${when(backup.at)} ? Toutes les tablettes reprendront cette version (l’état actuel est sauvegardé avant).`)) return;
        setBusy(true);
        const result = await restoreBackup(backup.id);
        setBusy(false);
        if (result.status === 200) {
            onRestored?.();
            onClose();
        } else {
            setError(errorMessage(result));
        }
    };

    return (
        <Modal isOpen onClose={onClose} title="Sauvegardes du serveur">
            <p className="rollback-intro">
                Le serveur garde une copie de l’inventaire au plus toutes les 15 minutes d’activité (pendant 3 jours)
                et une par jour (pendant 31 jours).
            </p>
            {error && <p className="login-error">{error}</p>}
            {!backups && !error && <p className="search-empty">Chargement…</p>}
            {backups && backups.length === 0 && <p className="search-empty">Aucune sauvegarde pour l’instant : la première sera faite à la prochaine modification.</p>}
            <ul className="rollback-list">
                {(backups || []).map(backup => (
                    <li key={backup.id} className="rollback-item">
                        <span className="rollback-main">
                            <span className="rollback-label">{when(backup.at)} · {KIND_LABELS[backup.kind] || backup.kind}</span>
                            <span className="rollback-time">
                                {backup.devices} appareils · {backup.loans} attributions · {backup.units} unités
                                {backup.by ? ` · par ${backup.by}` : ''}
                            </span>
                        </span>
                        <button type="button" className="rollback-go" disabled={busy} onClick={() => restore(backup)}>Restaurer</button>
                    </li>
                ))}
            </ul>
        </Modal>
    );
}
