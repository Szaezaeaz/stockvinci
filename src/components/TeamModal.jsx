import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import KeyboardTextField from './KeyboardTextField';
import { addUser, errorMessage, listUsers, updateUser } from '../services/auth';

const dateOf = (value) => (value ? new Date(value).toLocaleDateString() : 'jamais');
const validPin = (pin) => /^\d{6,12}$/.test(pin);

// Comptes de l'équipe (administrateurs) : ajouter quelqu'un avec un code de départ,
// lui donner un nouveau code, le passer administrateur, désactiver son compte (ses
// sessions sont coupées ; son nom reste dans l'historique).
export default function TeamModal({ me, onClose }) {
    const [users, setUsers] = useState(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [draft, setDraft] = useState({ name: '', pin: '', role: 'member' });
    const [pinFor, setPinFor] = useState(null); // id du compte dont on change le code
    const [newPin, setNewPin] = useState('');

    useEffect(() => {
        listUsers().then(result => {
            if (result.status === 200) setUsers(result.body.users);
            else setError(errorMessage(result));
        });
    }, []);

    const apply = async (promise, success) => {
        setError('');
        setNotice('');
        const result = await promise;
        if (result.status === 200) {
            setUsers(result.body.users);
            setNotice(success);
            return true;
        }
        setError(errorMessage(result));
        return false;
    };

    const add = async (e) => {
        e.preventDefault();
        if (!draft.name.trim()) return setError('Indique le nom.');
        if (!validPin(draft.pin)) return setError('Le code de départ doit faire de 6 à 12 chiffres.');
        if (await apply(addUser(draft.name, draft.pin, draft.role), `${draft.name.trim()} est ajouté(e). Donne-lui son code de vive voix.`)) {
            setDraft({ name: '', pin: '', role: 'member' });
        }
    };

    const savePin = async (user) => {
        if (!validPin(newPin)) return setError('Le code doit faire de 6 à 12 chiffres.');
        if (await apply(updateUser(user.id, { pin: newPin }), `Nouveau code enregistré pour ${user.name}.`)) {
            setPinFor(null);
            setNewPin('');
        }
    };

    const toggleActive = (user) => {
        const message = user.active
            ? `Désactiver le compte de ${user.name} ? Il ne pourra plus se connecter (son nom reste dans l’historique).`
            : `Réactiver le compte de ${user.name} ?`;
        if (window.confirm(message)) apply(updateUser(user.id, { active: !user.active }), user.active ? `${user.name} est désactivé(e).` : `${user.name} est réactivé(e).`);
    };

    const toggleRole = (user) => {
        const role = user.role === 'admin' ? 'member' : 'admin';
        if (window.confirm(role === 'admin' ? `Donner les droits administrateur à ${user.name} ?` : `Retirer les droits administrateur de ${user.name} ?`)) {
            apply(updateUser(user.id, { role }), `${user.name} est maintenant ${role === 'admin' ? 'administrateur' : 'membre'}.`);
        }
    };

    return (
        <Modal isOpen onClose={onClose} title="Équipe">
            <form onSubmit={add} className="team-add">
                <label className="section-label">AJOUTER UNE PERSONNE</label>
                <KeyboardTextField value={draft.name} onChange={(name) => setDraft(d => ({ ...d, name }))} placeholder="Prénom NOM" />
                <div className="team-add-row">
                    <input
                        type="text"
                        className="loan-input"
                        inputMode="numeric"
                        value={draft.pin}
                        onChange={(e) => setDraft(d => ({ ...d, pin: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                        placeholder="Code de départ (6+ chiffres)"
                        autoComplete="off"
                    />
                    <button type="button" className={`pill-toggle${draft.role === 'admin' ? ' active' : ''}`} onClick={() => setDraft(d => ({ ...d, role: d.role === 'admin' ? 'member' : 'admin' }))}>
                        {draft.role === 'admin' ? '✓ ' : ''}Administrateur
                    </button>
                </div>
                <button type="submit" className="btn-add full-width-btn">Ajouter</button>
            </form>

            {error && <p className="login-error">{error}</p>}
            {notice && <p className="team-notice">{notice}</p>}

            {!users && !error && <p className="search-empty">Chargement…</p>}
            <ul className="team-list">
                {(users || []).map(user => (
                    <li key={user.id} className={`team-item${user.active ? '' : ' team-item-inactive'}`}>
                        <div className="team-main">
                            <span className="team-name">{user.name}{user.id === me.id ? ' (toi)' : ''}</span>
                            <span className="team-sub">
                                {user.role === 'admin' ? 'Administrateur' : 'Membre'}
                                {user.active ? '' : ' · désactivé'}
                                {' · dernière connexion : '}{dateOf(user.lastLoginAt)}
                            </span>
                        </div>
                        <div className="team-actions">
                            <button type="button" className="assignment-return" onClick={() => { setPinFor(pinFor === user.id ? null : user.id); setNewPin(''); }}>Nouveau code</button>
                            {user.id !== me.id && (
                                <>
                                    <button type="button" className="assignment-return" onClick={() => toggleRole(user)}>{user.role === 'admin' ? 'Retirer admin' : 'Rendre admin'}</button>
                                    <button type="button" className="assignment-return" onClick={() => toggleActive(user)}>{user.active ? 'Désactiver' : 'Réactiver'}</button>
                                </>
                            )}
                        </div>
                        {pinFor === user.id && (
                            <div className="team-pin">
                                <input
                                    type="text"
                                    className="loan-input"
                                    inputMode="numeric"
                                    value={newPin}
                                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
                                    placeholder="Nouveau code (6+ chiffres)"
                                    autoComplete="off"
                                    autoFocus
                                />
                                <button type="button" className="btn-add" onClick={() => savePin(user)}>Enregistrer</button>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </Modal>
    );
}
