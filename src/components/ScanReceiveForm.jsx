import React, { useState } from 'react';
import { PHONE_MODEL_OPTIONS } from '../config/phoneAccessories';
import { PC_MODELS } from '../config/trackedModels';
import { conditionOfModel, parseScan, stockModelForFamily } from '../utils/scanParse';
import { useScanCapture } from '../hooks/useScanCapture';

const STATUS_LABELS = { stock: 'en stock', assigned: 'attribué' };

// Réception de stock par scan : une douchette en mode clavier (HID) saisit le
// contenu du code dans le champ toujours actif. Le QR code d'un PC HP contient
// n° de série, référence produit et nom du modèle : le modèle est alors reconnu
// et sélectionné automatiquement dans la liste. Chaque scan s'ajoute à la
// liste, validée en une fois.
export default function ScanReceiveForm({ devices, onReceive, onDone }) {
    const [model, setModel] = useState(PC_MODELS[0]);
    const [entries, setEntries] = useState([]); // [{ serial, model, modelName, productId }]
    const [value, setValue] = useState('');
    const [feedback, setFeedback] = useState(null); // { ok, text }
    const [useKeyboard, setUseKeyboard] = useState(false);

    const addSerial = (raw) => {
        const scan = parseScan(raw);
        const { serial } = scan;
        setValue('');
        refocus();
        if (!serial) return;

        if (entries.some(entry => entry.serial === serial)) {
            setFeedback({ ok: false, text: `${serial} : déjà scanné dans cette liste.` });
            return;
        }
        const known = devices?.[serial];
        if (known) {
            const status = STATUS_LABELS[known.status] || '';
            setFeedback({ ok: false, text: `${serial} : déjà enregistré (${known.model}${status ? `, ${status}` : ''}).` });
            return;
        }

        // Modèle reconnu depuis le QR code (en gardant l'état Neuf/Occasion choisi) :
        // il est sélectionné dans la liste. Sinon on garde le modèle sélectionné.
        const entryModel = scan.family ? stockModelForFamily(scan.family, conditionOfModel(model)) : model;
        if (scan.family) setModel(entryModel);

        setEntries(prev => [{ serial, model: entryModel, modelName: scan.modelName, productId: scan.productId }, ...prev]);
        if (scan.modelName && !scan.family) {
            setFeedback({ ok: true, text: `${serial} ajouté en ${entryModel} (modèle « ${scan.modelName} » non reconnu, à vérifier).` });
        } else {
            setFeedback({ ok: true, text: `${serial} ajouté · ${entryModel}` });
        }
    };

    const { focused, refocus, inputProps } = useScanCapture({
        value,
        setValue,
        onScan: addSerial,
        redirectKeys: true
    });

    const removeEntry = (serial) => {
        setEntries(prev => prev.filter(entry => entry.serial !== serial));
        refocus();
    };

    const handleConfirm = () => {
        if (entries.length === 0) return;
        onReceive(entries);
        setEntries([]);
        setFeedback(null);
        onDone();
    };

    return (
        <div className="scan-form">
            <div className="form-group">
                <label>Modèle</label>
                <select
                    className="loan-input"
                    value={model}
                    onChange={(e) => { setModel(e.target.value); e.target.blur(); refocus(); }}
                >
                    <optgroup label="PC portables">
                        {PC_MODELS.map(option => <option key={option} value={option}>{option}</option>)}
                    </optgroup>
                    <optgroup label="Téléphones">
                        {PHONE_MODEL_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                    </optgroup>
                </select>
                <p className="scan-hint">
                    Le modèle se sélectionne tout seul quand tu scannes le QR code d'un PC. Choisis ici Neuf ou
                    Occasion, ou le modèle à utiliser quand il n'est pas reconnu.
                </p>
            </div>

            <div className="form-group">
                <label>Scanner le QR code (ou code-barres) du PC</label>
                <input
                    {...inputProps}
                    type="text"
                    className={`loan-input scan-input${focused ? ' scan-input-active' : ''}`}
                    placeholder="Scanne le code…"
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
            </div>

            <div className="scan-list-header">
                <strong>{entries.length}</strong> appareil{entries.length > 1 ? 's' : ''} à ajouter
            </div>
            <ul className="scan-list">
                {entries.map(entry => (
                    <li key={entry.serial} className="scan-list-item">
                        <span className="scan-list-serial">
                            {entry.serial}
                            <small>{entry.model}</small>
                        </span>
                        <button type="button" className="scan-remove" onClick={() => removeEntry(entry.serial)} aria-label={`Retirer ${entry.serial}`}>
                            &times;
                        </button>
                    </li>
                ))}
            </ul>

            <button
                type="button"
                className="btn-add full-width-btn"
                style={{ marginTop: '16px', background: entries.length ? '#22c55e' : '#cbd5e1' }}
                disabled={entries.length === 0}
                onClick={handleConfirm}
            >
                {entries.length ? `Ajouter ${entries.length} au stock` : 'Scanne un premier appareil'}
            </button>
        </div>
    );
}
