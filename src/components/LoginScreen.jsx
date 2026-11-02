import React, { useEffect, useState } from 'react';
import PinPad from './PinPad';
import KeyboardTextField from './KeyboardTextField';
import { authStatus, errorMessage, forgetRecentUser, login, recentUsers, requestDevice, setupAdmin } from '../services/auth';

const DEVICE_CHECK_MS = 10000;

// Écran de connexion : on choisit son nom (ceux déjà connectés sur cette tablette
// sont proposés) puis on tape son code PIN. Un appareil inconnu doit d'abord être
// autorisé par un administrateur. Tant qu'aucun administrateur n'existe, ou pour
// récupérer l'accès, le code maître permet de créer un administrateur.
export default function LoginScreen({ initialName = '', onLogin }) {
    const [mode, setMode] = useState('login'); // 'login' | 'setup'
    const [configured, setConfigured] = useState(true);
    const [serverIssue, setServerIssue] = useState('');
    const [recent, setRecent] = useState(recentUsers);
    const [name, setName] = useState(initialName || recentUsers()[0] || '');
    const [typingName, setTypingName] = useState(() => !(initialName || recentUsers()[0]));
    const [pin, setPin] = useState('');
    const [masterCode, setMasterCode] = useState('');
    const [pinConfirm, setPinConfirm] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [device, setDevice] = useState({ state: 'checking', code: '' }); // state : checking | unknown | pending | approved
    const [deviceLabel, setDeviceLabel] = useState('');

    useEffect(() => {
        let cancelled = false;
        authStatus().then(result => {
            if (cancelled) return;
            if (result.status === 200) {
                setConfigured(result.body.configured);
                setDevice({ state: result.body.device, code: result.body.code || '' });
                if (!result.body.configured) setMode('setup');
            } else {
                setServerIssue(errorMessage(result));
            }
        });
        return () => { cancelled = true; };
    }, []);

    // En attente : l'écran passe à la connexion dès que l'administrateur a approuvé.
    useEffect(() => {
        if (device.state !== 'pending') return undefined;
        const timer = setInterval(async () => {
            const result = await authStatus();
            if (result.status === 200) setDevice({ state: result.body.device, code: result.body.code || '' });
        }, DEVICE_CHECK_MS);
        return () => clearInterval(timer);
    }, [device.state]);

    const askApproval = async () => {
        if (busy) return;
        if (!deviceLabel.trim()) return setError('Donne un nom à cet appareil (ex. Tablette support 2).');
        setBusy(true);
        setError('');
        const result = await requestDevice(deviceLabel);
        setBusy(false);
        if (result.status === 200) setDevice({ state: result.body.device, code: result.body.code || '' });
        else setError(errorMessage(result));
    };

    const finish = (result) => {
        setBusy(false);
        if (result.status === 200) {
            onLogin({ token: result.body.token, user: result.body.user });
            return;
        }
        setError(errorMessage(result));
        setPin('');
        setPinConfirm('');
        if (result.body?.error === 'device_not_approved') setDevice({ state: 'unknown', code: '' });
    };

    const submitLogin = async () => {
        if (busy) return;
        if (!name.trim()) return setError('Choisis ou tape ton nom.');
        if (pin.length < 6) return setError('Ton code fait au moins 6 chiffres.');
        setBusy(true);
        setError('');
        finish(await login(name, pin));
    };

    const submitSetup = async (e) => {
        e?.preventDefault();
        if (busy) return;
        if (!masterCode) return setError('Tape le code maître.');
        if (!name.trim()) return setError('Indique ton nom.');
        if (pin.length < 6) return setError('Choisis un code de 6 à 12 chiffres.');
        if (pin !== pinConfirm) return setError('Les deux codes ne sont pas identiques.');
        setBusy(true);
        setError('');
        finish(await setupAdmin(masterCode, name, pin));
    };

    const pickRecent = (other) => {
        setName(other);
        setTypingName(false);
        setPin('');
        setError('');
    };

    return (
        <div className="login-screen">
            <div className="login-card">
                <div className="login-brand">
                    <img src="/icon.svg" alt="" width="56" height="56" />
                    <div>
                        <h1>Inventaire</h1>
                        <p>Support informatique</p>
                    </div>
                </div>

                {serverIssue && <p className="login-error">{serverIssue}</p>}

                {mode === 'login' && device.state === 'checking' && !serverIssue && <p className="login-intro">Vérification de l’appareil…</p>}

                {mode === 'login' && (device.state === 'unknown' || device.state === 'pending') && (
                    <>
                        <h2 className="login-title">Appareil non autorisé</h2>
                        {device.state === 'unknown' ? (
                            <>
                                <p className="login-intro">Seuls les appareils du support peuvent se connecter. Demande l’autorisation pour celui-ci.</p>
                                <div className="form-group">
                                    <label>Nom de cet appareil</label>
                                    <KeyboardTextField value={deviceLabel} onChange={setDeviceLabel} placeholder="Ex. Tablette support 2" onEnter={askApproval} />
                                </div>
                                <button type="button" className="btn-add full-width-btn login-submit" onClick={askApproval} disabled={busy}>
                                    {busy ? 'Envoi…' : 'Demander l’autorisation'}
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="login-intro">Un administrateur doit approuver cet appareil dans « Appareils », en vérifiant ce code :</p>
                                <p className="device-code">{device.code}</p>
                                <p className="login-intro">Cet écran s’ouvrira tout seul une fois l’appareil approuvé.</p>
                            </>
                        )}
                        {error && <p className="login-error">{error}</p>}
                        <button type="button" className="scan-link login-help-link" onClick={() => { setMode('setup'); setError(''); }}>
                            Administrateur : récupérer l’accès avec le code maître
                        </button>
                    </>
                )}

                {mode === 'login' && device.state === 'approved' && (
                    <>
                        <h2 className="login-title">Connexion</h2>

                        {recent.length > 0 && (
                            <div className="login-people">
                                {recent.map(other => (
                                    <span key={other} className={`login-person${!typingName && other === name ? ' active' : ''}`}>
                                        <button type="button" onClick={() => pickRecent(other)}>{other}</button>
                                        <button
                                            type="button"
                                            className="login-person-forget"
                                            aria-label={`Retirer ${other} de cette tablette`}
                                            onClick={() => {
                                                forgetRecentUser(other);
                                                setRecent(recentUsers());
                                                if (other === name) { setName(''); setTypingName(true); }
                                            }}
                                        >
                                            &times;
                                        </button>
                                    </span>
                                ))}
                                <button type="button" className={`login-person login-person-other${typingName ? ' active' : ''}`} onClick={() => { setTypingName(true); setName(''); }}>
                                    Autre personne
                                </button>
                            </div>
                        )}

                        {typingName && (
                            <div className="form-group">
                                <label>Ton nom</label>
                                <KeyboardTextField value={name} onChange={setName} placeholder="Prénom NOM" autoFocus />
                            </div>
                        )}

                        <PinPad label={!typingName && name ? `Code de ${name}` : 'Ton code'} value={pin} onChange={(v) => { setPin(v); setError(''); }} onSubmit={submitLogin} submitLabel={busy ? '…' : 'OK'} autoFocus={!typingName} />

                        {error && <p className="login-error">{error}</p>}

                        <button type="button" className="btn-add full-width-btn login-submit" onClick={submitLogin} disabled={busy}>
                            {busy ? 'Connexion…' : 'Se connecter'}
                        </button>

                        <button type="button" className="scan-link login-help-link" onClick={() => setHelpOpen(open => !open)}>Code oublié ?</button>
                        {helpOpen && (
                            <div className="login-help">
                                <p>Demande à un administrateur de l’appli de te donner un nouveau code.</p>
                                <button type="button" className="scan-link" onClick={() => { setMode('setup'); setError(''); setPin(''); }}>
                                    Administrateur : récupérer l’accès avec le code maître
                                </button>
                            </div>
                        )}
                    </>
                )}

                {mode === 'setup' && (
                    <form onSubmit={submitSetup}>
                        <h2 className="login-title">{configured ? 'Récupérer l’accès administrateur' : 'Première mise en service'}</h2>
                        <p className="login-intro">
                            {configured
                                ? 'Le code maître permet de redéfinir le code d’un administrateur (ou d’en créer un).'
                                : 'Crée ton compte administrateur avec le code maître. Tu pourras ensuite ajouter l’équipe.'}
                        </p>
                        <div className="form-group">
                            <label>Code maître</label>
                            <input
                                type="password"
                                className="loan-input login-master"
                                value={masterCode}
                                onChange={(e) => setMasterCode(e.target.value)}
                                autoComplete="off"
                                placeholder="Code maître (variable INVENTORY_PASSCODE)"
                            />
                        </div>
                        <div className="form-group">
                            <label>Ton nom</label>
                            <KeyboardTextField value={name} onChange={setName} placeholder="Prénom NOM" />
                        </div>
                        <PinPad label="Ton code (6 à 12 chiffres)" value={pin} onChange={setPin} />
                        <div className="form-group">
                            <label>Confirme ton code</label>
                            <input
                                type="password"
                                className="loan-input login-master"
                                inputMode="numeric"
                                value={pinConfirm}
                                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 12))}
                                autoComplete="off"
                                placeholder="Retape le code"
                            />
                        </div>
                        {error && <p className="login-error">{error}</p>}
                        <button type="submit" className="btn-add full-width-btn login-submit" disabled={busy}>
                            {busy ? 'Enregistrement…' : 'Créer et se connecter'}
                        </button>
                        {configured && (
                            <button type="button" className="scan-link login-help-link" onClick={() => { setMode('login'); setError(''); setPin(''); }}>
                                ← Retour à la connexion
                            </button>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
}
