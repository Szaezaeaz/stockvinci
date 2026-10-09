import React, { useState } from 'react';
import { PHONE_MODEL_OPTIONS } from '../config/phoneAccessories';
import { PC_FAMILIES } from '../config/trackedModels';
import { parseScan, stockModelForFamily } from '../utils/scanParse';
import { useScanCapture } from '../hooks/useScanCapture';

const STATUS_LABELS = { stock: 'en stock', assigned: 'attribué' };

// Modèle de stock d'un appareil scanné : téléphone = son modèle ; PC = famille
// + état (Neuf/Occasion) choisi après le scan.
function resolveModel(entry) {
    return entry.kind === 'phone' ? entry.model : stockModelForFamily(entry.family, entry.condition);
}

// Réception de stock par scan : une douchette en mode clavier (HID) saisit le
// contenu du code dans le champ toujours actif. Le QR code d'un PC HP contient
// n° de série, référence produit et nom du modèle : le modèle est alors reconnu
// et sélectionné dans la liste. Le QR ne dit pas si le PC est neuf ou
// d'occasion : on le choisit pour chaque PC après le scan, puis on valide.
export default function ScanReceiveForm({ devices, onReceive, onDone }) {
    const [model, setModel] = useState(PC_FAMILIES[0]); // famille de PC ou modèle de téléphone
    const [entries, setEntries] = useState([]); // [{ serial, kind, family, model, condition, modelName, productId }]
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

        // Modèle reconnu depuis le QR code : il est sélectionné dans la liste.
        // Sinon on garde le modèle sélectionné (téléphone ou famille de PC).
        if (scan.family) setModel(scan.family);
        const isPhone = !scan.family && PHONE_MODEL_OPTIONS.includes(model);
        const family = scan.family || (isPhone ? null : model);
        const entry = {
            serial,
            kind: isPhone ? 'phone' : 'pc',
            family,
            model: isPhone ? model : null,
            condition: isPhone ? 'n/a' : (family === '850 G8/G10' ? 'Occasion' : null),
            modelName: scan.modelName,
            productId: scan.productId
        };
        setEntries(prev => [entry, ...prev]);

        const label = isPhone ? model : family;
        if (scan.modelName && !scan.family) {
            setFeedback({ ok: true, text: `${serial} ajouté en ${label} (modèle « ${scan.modelName} » non reconnu, à vérifier).` });
        } else {
            setFeedback({ ok: true, text: `${serial} ajouté · ${label}${entry.condition === null ? ' — choisis Neuf ou Occasion' : ''}` });
        }
    };

    const { focused, refocus, inputProps } = useScanCapture({
        value,
        setValue,
        onScan: addSerial,
        redirectKeys: true
    });

    const setCondition = (serial, condition) => {
        setEntries(prev => prev.map(entry => (entry.serial === serial ? { ...entry, condition } : entry)));
    };

    // Applique un état à tous les PC dont l'état n'est pas encore choisi.
    const setAllUnset = (condition) => {
        setEntries(prev => prev.map(entry => (entry.condition === null ? { ...entry, condition } : entry)));
    };

    const removeEntry = (serial) => {
        setEntries(prev => prev.filter(entry => entry.serial !== serial));
        refocus();
    };

    const unsetCount = entries.filter(entry => entry.condition === null).length;
    const canConfirm = entries.length > 0 && unsetCount === 0;

    const handleConfirm = () => {
        if (!canConfirm) return;
        onReceive(entries.map(entry => ({
            serial: entry.serial,
            model: resolveModel(entry),
            modelName: entry.modelName,
            productId: entry.productId
        })));
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
                        {PC_FAMILIES.map(option => <option key={option} value={option}>{option}</option>)}
                    </optgroup>
                    <optgroup label="Téléphones">
                        {PHONE_MODEL_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                    </optgroup>
                </select>
                <p className="scan-hint">
                    Le modèle se sélectionne tout seul quand tu scannes le QR code d'un PC. Choisis-le ici quand il
                    n'est pas reconnu. Neuf ou Occasion se choisit pour chaque PC après le scan.
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

            {unsetCount > 0 && (
                <div className="scan-bulk">
                    <span>{unsetCount} PC sans état :</span>
                    <button type="button" onClick={() => setAllUnset('Neuf')}>Tout en Neuf</button>
                    <button type="button" onClick={() => setAllUnset('Occasion')}>Tout en Occasion</button>
                </div>
            )}

            <ul className="scan-list">
                {entries.map(entry => (
                    <li key={entry.serial} className="scan-list-item">
                        <span className="scan-list-serial">
                            {entry.serial}
                            <small>{entry.kind === 'phone' ? entry.model : entry.family}</small>
                        </span>
                        <span className="scan-list-actions">
                            {entry.kind === 'pc' && (
                                <span className={`scan-condition${entry.condition === null ? ' scan-condition-unset' : ''}`}>
                                    {['Neuf', 'Occasion'].map(option => {
                                        const locked = entry.family === '850 G8/G10' && option === 'Neuf';
                                        return (
                                            <button
                                                key={option}
                                                type="button"
                                                disabled={locked}
                                                className={entry.condition === option ? 'active' : ''}
                                                onClick={() => setCondition(entry.serial, option)}
                                            >
                                                {option}
                                            </button>
                                        );
                                    })}
                                </span>
                            )}
                            <button type="button" className="scan-remove" onClick={() => removeEntry(entry.serial)} aria-label={`Retirer ${entry.serial}`}>
                                &times;
                            </button>
                        </span>
                    </li>
                ))}
            </ul>

            <button
                type="button"
                className="btn-add full-width-btn"
                style={{ marginTop: '16px', background: canConfirm ? '#22c55e' : '#cbd5e1' }}
                disabled={!canConfirm}
                onClick={handleConfirm}
            >
                {entries.length === 0
                    ? 'Scanne un premier appareil'
                    : unsetCount > 0
                        ? `Choisis Neuf ou Occasion (${unsetCount} PC)`
                        : `Ajouter ${entries.length} au stock`}
            </button>
        </div>
    );
}
