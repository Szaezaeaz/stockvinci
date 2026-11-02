import React, { useContext, useState } from 'react';
import Modal from './Modal';
import PinPad from './PinPad';
import TeamModal from './TeamModal';
import BackupsModal from './BackupsModal';
import DevicesModal from './DevicesModal';
import { AuthContext } from '../utils/AuthContext';
import { changePin, errorMessage } from '../services/auth';

// Pastille de la personne connectée (en-tête) : verrouiller, changer son code et,
// pour un administrateur, gérer l'équipe et les sauvegardes du serveur.
// onRestored : appelé après la restauration d'une sauvegarde (relance la synchro).
export default function UserMenu({ onRestored }) {
    const { user, lock, replaceSession } = useContext(AuthContext);
    const [panel, setPanel] = useState(null); // null | 'menu' | 'pin' | 'team' | 'devices' | 'backups'
    if (!user) return null;
    const isAdmin = user.role === 'admin';
    const firstName = user.name.split(' ')[0];

    return (
        <>
            <button type="button" className="user-pill" onClick={() => setPanel('menu')} aria-label={`Connecté : ${user.name}`}>
                <span className="user-pill-avatar" aria-hidden="true">{firstName.charAt(0).toUpperCase()}</span>
                {firstName}
            </button>

            <Modal isOpen={panel === 'menu'} onClose={() => setPanel(null)} title={user.name}>
                <p className="user-menu-role">{isAdmin ? 'Administrateur' : 'Membre de l’équipe'}</p>
                <div className="user-menu-actions">
                    <button type="button" className="user-menu-item" onClick={() => { setPanel(null); lock(); }}>
                        🔒 Verrouiller maintenant
                        <small>L’appli se verrouille aussi seule après 15 min sans activité.</small>
                    </button>
                    <button type="button" className="user-menu-item" onClick={() => setPanel('pin')}>🔑 Changer mon code</button>
                    {isAdmin && <button type="button" className="user-menu-item" onClick={() => setPanel('team')}>👥 Gérer l’équipe</button>}
                    {isAdmin && <button type="button" className="user-menu-item" onClick={() => setPanel('devices')}>📱 Appareils autorisés</button>}
                    {isAdmin && <button type="button" className="user-menu-item" onClick={() => setPanel('backups')}>🗄 Sauvegardes du serveur</button>}
                </div>
            </Modal>

            {panel === 'pin' && <ChangePinModal onClose={() => setPanel(null)} onChanged={replaceSession} />}
            {panel === 'team' && <TeamModal me={user} onClose={() => setPanel(null)} />}
            {panel === 'devices' && <DevicesModal onClose={() => setPanel(null)} />}
            {panel === 'backups' && <BackupsModal onClose={() => setPanel(null)} onRestored={onRestored} />}
        </>
    );
}

function ChangePinModal({ onClose, onChanged }) {
    const [step, setStep] = useState('current'); // 'current' | 'new' | 'confirm'
    const [codes, setCodes] = useState({ current: '', new: '', confirm: '' });
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const labels = { current: 'Ton code actuel', new: 'Nouveau code (6 à 12 chiffres)', confirm: 'Retape le nouveau code' };
    const next = async () => {
        setError('');
        if (codes[step].length < 6) return setError('Au moins 6 chiffres.');
        if (step === 'current') return setStep('new');
        if (step === 'new') return setStep('confirm');
        if (codes.confirm !== codes.new) {
            setCodes(c => ({ ...c, new: '', confirm: '' }));
            setStep('new');
            return setError('Les deux codes ne sont pas identiques.');
        }
        const result = await changePin(codes.current, codes.new);
        if (result.status === 200) {
            onChanged({ token: result.body.token, user: result.body.user });
            setDone(true);
            return;
        }
        setCodes({ current: '', new: '', confirm: '' });
        setStep('current');
        setError(result.status === 403 ? 'Code actuel incorrect.' : errorMessage(result));
    };

    return (
        <Modal isOpen onClose={onClose} title="Changer mon code">
            {done ? (
                <>
                    <p>Ton code est changé. Il sert dès maintenant sur toutes les tablettes.</p>
                    <button type="button" className="btn-add full-width-btn" onClick={onClose}>Fermer</button>
                </>
            ) : (
                <>
                    <PinPad key={step} label={labels[step]} value={codes[step]} onChange={(v) => setCodes(c => ({ ...c, [step]: v }))} onSubmit={next} autoFocus />
                    {error && <p className="login-error">{error}</p>}
                </>
            )}
        </Modal>
    );
}
