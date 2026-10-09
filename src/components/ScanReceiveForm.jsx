import React, { useRef, useState } from 'react';
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

// Réception de stock par scan : une douchette en mode clavier (HID) "tape" le
// n° de série puis Entrée dans le champ toujours actif ; chaque scan s'ajoute à
// la liste, validée en une fois.
export default function ScanReceiveForm({ devices, onReceive, onDone }) {
    const [model, setModel] = useState(PC_MODELS[0]);
    const [serials, setSerials] = useState([]);
    const [value, setValue] = useState('');
    const [feedback, setFeedback] = useState(null); // { ok, text }
    const [useKeyboard, setUseKeyboard] = useState(false);
    const inputRef = useRef(null);

    const refocus = () => setTimeout(() => inputRef.current?.focus(), 0);

    const handleScan = (e) => {
        e.preventDefault();
        const serial = normalizeSerial(value);
        setValue('');
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
                    onChange={(e) => setModel(e.target.value)}
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

            <form onSubmit={handleScan} className="form-group">
                <label>Scanner un n° de série</label>
                <input
                    ref={inputRef}
                    type="text"
                    className="loan-input scan-input"
                    placeholder="Scanne le code-barres…"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    inputMode={useKeyboard ? 'text' : 'none'}
                    autoFocus
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                />
                <button type="button" className="scan-link" onClick={() => { setUseKeyboard(v => !v); refocus(); }}>
                    {useKeyboard ? 'Masquer le clavier de la tablette' : 'Saisir à la main (clavier de la tablette)'}
                </button>
                {feedback && (
                    <p className={`scan-feedback ${feedback.ok ? 'scan-ok' : 'scan-error'}`}>{feedback.text}</p>
                )}
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
