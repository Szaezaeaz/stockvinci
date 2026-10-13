import React, { useState } from 'react';
import ModelPicker from './ModelPicker';
import { parseScan } from '../utils/scanParse';
import {
    aliasKeyToLearn, deviceModelLabel, exactModelFor, isOccasionOnly, kindOfModel, listModelChoices, modelLabel, modelOf, stockKeyOf
} from '../utils/models';
import { useScanCapture } from '../hooks/useScanCapture';

const STATUS_LABELS = { stock: 'en stock', assigned: 'attribué' };
const DEFAULT_MODEL = listModelChoices()[0];

// État d'un appareil selon son modèle : sans objet pour un téléphone, forcément
// Occasion pour certains PC, sinon à choisir (null) après le scan.
function conditionFor(model, previous = null) {
    if (!model) return previous;
    if (kindOfModel(model) === 'phone') return 'n/a';
    if (isOccasionOnly(model)) return 'Occasion';
    return previous === 'Neuf' || previous === 'Occasion' ? previous : null;
}

// Ligne de la liste pour un code scanné. Un QR code de PC indique son modèle :
// s'il n'est pas reconnu, la ligne attend qu'on le choisisse (model null), et ce
// choix sera retenu (learnKey). Un code sans modèle (téléphone, simple
// code-barres) prend le modèle sélectionné en haut du formulaire.
// model : modèle de l'appli ("650 G11") ; qrModel : modèle précis lu dans le QR.
// sessionChoices : modèles déjà choisis à la main dans cette liste, par learnKey.
function createEntry(scan, selectedModel, sessionChoices = {}) {
    const fromQr = Boolean(scan.modelName);
    const learnKey = fromQr && !scan.model ? aliasKeyToLearn(scan) : '';
    const recognized = fromQr ? (scan.model || sessionChoices[learnKey] || null) : selectedModel;
    const model = recognized ? modelOf(recognized) : null;
    const entry = {
        serial: scan.serial,
        model,
        qrModel: fromQr ? scan.model : null,
        condition: conditionFor(model),
        modelName: scan.modelName,
        productId: scan.productId,
        candidates: scan.candidates,
        unrecognized: fromQr && !scan.model,
        learnKey
    };
    const feedback = model
        ? { ok: true, text: `${scan.serial} ajouté · ${modelLabel(model)}${entry.condition === null ? ' — choisis Neuf ou Occasion' : ''}` }
        : { ok: false, text: `${scan.serial} ajouté, mais le modèle « ${scan.modelName} » n'est pas reconnu : choisis-le sur sa ligne.` };
    return { entry, feedback };
}

// Réception de stock par scan : une douchette en mode clavier (HID) saisit le
// contenu du code dans le champ toujours actif. Le QR code d'un PC HP contient
// n° de série, référence produit et nom du modèle : le modèle est alors
// reconnu. Le QR ne dit pas si le PC est neuf ou d'occasion : on le choisit pour
// chaque PC après le scan, puis on valide.
// initialScan : code déjà scanné ailleurs (accueil) à ajouter dès l'ouverture.
export default function ScanReceiveForm({ devices, onReceive, onDone, initialScan }) {
    const [initial] = useState(() => {
        const scan = initialScan ? parseScan(initialScan) : null;
        return scan?.serial ? { scan, ...createEntry(scan, DEFAULT_MODEL) } : null;
    });
    // modèle des codes qui n'en indiquent pas (téléphones, simples codes-barres)
    const [model, setModel] = useState(initial?.entry.model || DEFAULT_MODEL);
    const [entries, setEntries] = useState(initial ? [initial.entry] : []);
    const [value, setValue] = useState('');
    const [feedback, setFeedback] = useState(initial ? initial.feedback : null); // { ok, text }
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
            setFeedback({ ok: false, text: `${serial} : déjà enregistré (${deviceModelLabel(known)}${status ? `, ${status}` : ''}).` });
            return;
        }

        // Modèle reconnu depuis le QR code : il devient le modèle sélectionné.
        if (scan.model) setModel(modelOf(scan.model));
        const sessionChoices = Object.fromEntries(
            entries.filter(entry => entry.learnKey && entry.model).map(entry => [entry.learnKey, entry.model])
        );
        const created = createEntry(scan, model, sessionChoices);
        setEntries(prev => [created.entry, ...prev]);
        setFeedback(created.feedback);
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

    // Modèle choisi à la main pour une ligne. Les autres lignes du même QR code non
    // reconnu, encore sans modèle, le reçoivent aussi.
    const setEntryModel = (serial, model) => {
        setEntries(prev => {
            const target = prev.find(entry => entry.serial === serial);
            return prev.map(entry => {
                const sameUnknown = target?.learnKey && entry.learnKey === target.learnKey && !entry.model;
                if (entry.serial !== serial && !sameUnknown) return entry;
                return { ...entry, model, condition: conditionFor(model, entry.condition) };
            });
        });
        refocus();
    };

    // Applique un état à tous les PC dont l'état n'est pas encore choisi.
    const setAllUnset = (condition) => {
        setEntries(prev => prev.map(entry => (entry.model && entry.condition === null ? { ...entry, condition } : entry)));
    };

    const removeEntry = (serial) => {
        setEntries(prev => prev.filter(entry => entry.serial !== serial));
        refocus();
    };

    const noModelCount = entries.filter(entry => !entry.model).length;
    const unsetCount = entries.filter(entry => entry.model && entry.condition === null).length;
    const canConfirm = entries.length > 0 && noModelCount === 0 && unsetCount === 0;

    const handleConfirm = () => {
        if (!canConfirm) return;
        onReceive(entries.map(entry => ({
            serial: entry.serial,
            model: stockKeyOf(entry.model, entry.condition),
            exactModel: exactModelFor(entry.model, entry.qrModel) || undefined,
            modelName: entry.modelName,
            productId: entry.productId,
            learnKey: entry.learnKey,
            learnModel: entry.model
        })));
        setEntries([]);
        setFeedback(null);
        onDone();
    };

    return (
        <div className="scan-form">
            <div className="form-group">
                <label>Modèle</label>
                <ModelPicker value={model} onChange={(name) => { setModel(name); refocus(); }} devices={devices} />
                <p className="scan-hint">
                    Le QR code d'un PC indique son modèle : il est reconnu tout seul. Pour un téléphone ou un simple
                    code-barres, choisis le modèle ici avant de scanner. Neuf ou Occasion se choisit pour chaque PC
                    après le scan.
                </p>
            </div>

            <div className="form-group">
                <label>Scanner le QR code (ou code-barres) de l'appareil</label>
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
                            <ModelPicker
                                compact
                                value={entry.model || ''}
                                onChange={(name) => setEntryModel(entry.serial, name)}
                                devices={devices}
                                suggestions={entry.candidates}
                                placeholder="Modèle à choisir"
                            />
                            {entry.unrecognized && entry.model && entry.learnKey && (
                                <small>retenu pour les prochains scans</small>
                            )}
                        </span>
                        <span className="scan-list-actions">
                            {entry.model && entry.condition !== 'n/a' && (
                                <span className={`scan-condition${entry.condition === null ? ' scan-condition-unset' : ''}`}>
                                    {['Neuf', 'Occasion'].map(option => {
                                        const locked = isOccasionOnly(entry.model) && option === 'Neuf';
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
                    : noModelCount > 0
                        ? `Choisis le modèle (${noModelCount} appareil${noModelCount > 1 ? 's' : ''})`
                        : unsetCount > 0
                            ? `Choisis Neuf ou Occasion (${unsetCount} PC)`
                            : `Ajouter ${entries.length} au stock`}
            </button>
        </div>
    );
}
