import React, { useEffect, useRef, useState } from 'react';
import { PHONE_MODEL_OPTIONS } from '../config/phoneAccessories';
import { normalizeSerial } from '../utils/serial';

const PC_MODELS = [
    '650 G11 Neuf',
    '650 G11 Occasion',
    '850 G8/G10 Occasion',
    'X360 Neuf',
    'X360 Occasion',
    'Zbook Neuf',
    'Zbook Occasion'
];

const STATUS_LABELS = { stock: 'en stock', assigned: 'attribué' };

// Une douchette "tape" les caractères en rafale (quelques ms entre deux) : on
// repère cette rafale pour valider le scan même si la douchette n'envoie pas
// Entrée à la fin. Une saisie à la main est trop lente pour déclencher ça.
const BURST_GAP_MS = 60;
const BURST_MIN_CHARS = 5;
const BURST_IDLE_MS = 250;

// Réception de stock par scan : une douchette en mode clavier (HID) saisit le
// n° de série dans le champ toujours actif ; chaque scan s'ajoute à la liste,
// validée en une fois.
export default function ScanReceiveForm({ devices, onReceive, onDone }) {
    const [model, setModel] = useState(PC_MODELS[0]);
    const [serials, setSerials] = useState([]);
    const [value, setValue] = useState('');
    const [feedback, setFeedback] = useState(null); // { ok, text }
    const [useKeyboard, setUseKeyboard] = useState(false);
    const [focused, setFocused] = useState(false);
    const inputRef = useRef(null);
    const lastChangeRef = useRef(0);
    const burstRef = useRef(0);
    const idleTimerRef = useRef(null);
    const addSerialRef = useRef(null);

    const refocus = () => setTimeout(() => inputRef.current?.focus(), 0);

    const addSerial = (raw) => {
        const serial = normalizeSerial(raw);
        setValue('');
        burstRef.current = 0;
        clearTimeout(idleTimerRef.current);
        refocus();
        if (!serial) return;

        if (serials.includes(serial)) {
            setFeedback({ ok: false, text: `${serial} : déjà scanné dans cette liste.` });
            return;
        }
        const known = devices?.[serial];
        if (known) {
            const status = STATUS_LABELS[known.status] || '';
            setFeedback({ ok: false, text: `${serial} : déjà enregistré (${known.model}${status ? `, ${status}` : ''}).` });
            return;
        }
        setSerials(prev => [serial, ...prev]);
        setFeedback({ ok: true, text: `${serial} ajouté.` });
    };

    // Garde la dernière version de addSerial pour le minuteur de fin de rafale.
    useEffect(() => {
        addSerialRef.current = addSerial;
    });

    useEffect(() => {
        inputRef.current?.focus();
        return () => clearTimeout(idleTimerRef.current);
    }, []);

    const handleValue = (next) => {
        setValue(next);

        const now = Date.now();
        burstRef.current = now - lastChangeRef.current < BURST_GAP_MS ? burstRef.current + 1 : 1;
        lastChangeRef.current = now;

        clearTimeout(idleTimerRef.current);
        if (burstRef.current >= BURST_MIN_CHARS) {
            idleTimerRef.current = setTimeout(() => addSerialRef.current(next), BURST_IDLE_MS);
        }
    };

    const handleValueRef = useRef(handleValue);
    useEffect(() => {
        handleValueRef.current = handleValue;
    });

    // La douchette "tape" dans l'élément qui a le focus. Si c'est autre chose que
    // le champ de scan (liste déroulante du modèle, bouton…), la première touche
    // est redirigée vers le champ pour que le scan ne soit jamais perdu ni ne
    // change le modèle par erreur.
    useEffect(() => {
        const onKeyDown = (e) => {
            const input = inputRef.current;
            if (!input || document.activeElement === input) return;
            if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            e.preventDefault();
            input.focus();
            input.value += e.key;
            handleValueRef.current(input.value);
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, []);

    const handleChange = (e) => handleValue(e.target.value);

    const handleSubmit = (e) => {
        e.preventDefault();
        addSerial(value);
    };

    // Certaines douchettes terminent le scan par Tab au lieu d'Entrée.
    const handleKeyDown = (e) => {
        if (e.key === 'Tab' && value) {
            e.preventDefault();
            addSerial(value);
        }
    };

    const removeSerial = (serial) => {
        setSerials(prev => prev.filter(s => s !== serial));
        refocus();
    };

    const handleConfirm = () => {
        if (serials.length === 0) return;
        onReceive(model, serials);
        setSerials([]);
        setFeedback(null);
        onDone();
    };

    return (
        <div className="scan-form">
            <div className="form-group">
                <label>Modèle réceptionné</label>
                <select
                    className="loan-input"
                    value={model}
                    onChange={(e) => { setModel(e.target.value); e.target.blur(); refocus(); }}
                    disabled={serials.length > 0}
                >
                    <optgroup label="PC portables">
                        {PC_MODELS.map(option => <option key={option} value={option}>{option}</option>)}
                    </optgroup>
                    <optgroup label="Téléphones">
                        {PHONE_MODEL_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                    </optgroup>
                </select>
                {serials.length > 0 && (
                    <p className="scan-hint">Valide ou vide la liste pour changer de modèle.</p>
                )}
            </div>

            <form onSubmit={handleSubmit} className="form-group">
                <label>Scanner un n° de série</label>
                <input
                    ref={inputRef}
                    type="text"
                    className={`loan-input scan-input${focused ? ' scan-input-active' : ''}`}
                    placeholder="Scanne le code-barres…"
                    value={value}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    inputMode={useKeyboard ? 'text' : 'none'}
                    autoFocus
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                />
                <p className={`scan-status ${focused ? 'scan-status-ready' : 'scan-status-idle'}`}>
                    {focused ? '● Prêt à scanner' : '○ Touche le champ ci-dessus pour activer le scan'}
                </p>
                <button type="button" className="scan-link" onClick={() => { setUseKeyboard(v => !v); refocus(); }}>
                    {useKeyboard ? 'Masquer le clavier de la tablette' : 'Saisir à la main (clavier de la tablette)'}
                </button>
                {feedback && (
                    <p className={`scan-feedback ${feedback.ok ? 'scan-ok' : 'scan-error'}`}>{feedback.text}</p>
                )}
                <p className="scan-hint">
                    Rien ne s'affiche quand tu scannes ? Vérifie que la douchette est en mode clavier (HID) et connectée,
                    puis teste-la dans une autre application (Notes).
                </p>
            </form>

            <div className="scan-list-header">
                <strong>{serials.length}</strong> appareil{serials.length > 1 ? 's' : ''} à ajouter
            </div>
            <ul className="scan-list">
                {serials.map(serial => (
                    <li key={serial} className="scan-list-item">
                        <span>{serial}</span>
                        <button type="button" className="scan-remove" onClick={() => removeSerial(serial)} aria-label={`Retirer ${serial}`}>
                            &times;
                        </button>
                    </li>
                ))}
            </ul>

            <button
                type="button"
                className="btn-add full-width-btn"
                style={{ marginTop: '16px', background: serials.length ? '#22c55e' : '#cbd5e1' }}
                disabled={serials.length === 0}
                onClick={handleConfirm}
            >
                {serials.length ? `Ajouter ${serials.length} au stock` : 'Scanne un premier appareil'}
            </button>
        </div>
    );
}
