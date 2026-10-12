import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { PHONE_MODEL_OPTIONS } from '../config/phoneAccessories';
import { PC_FAMILIES, PC_MODELS } from '../config/trackedModels';
import { matchesQuery } from '../utils/search';
import { parseScan, stockModelForFamily } from '../utils/scanParse';
import { useScanCapture } from '../hooks/useScanCapture';

const dateOf = (value) => (value ? new Date(value).toLocaleDateString() : '');
const iconOf = (kind) => (kind === 'phone' ? '📱' : '💻');

// Matériel à attribuer : un seul champ de scan pour les PC et les téléphones, la
// liste de ce qui est ajouté, et (repliée) la liste du stock pour choisir à la main.
// items : [{ uid, kind: 'pc' | 'phone', model, serial }] (serial vide = stock ancien).
export default function AssignmentPicker({ devices, items, onItemsChange, onCreateDevice, initialScan, onInitialScanHandled }) {
    const [query, setQuery] = useState('');
    const [message, setMessage] = useState(null); // { ok, text }
    const [unknown, setUnknown] = useState(null); // appareil scanné absent de la base
    const [stockOpen, setStockOpen] = useState(false);
    const [pickKind, setPickKind] = useState('pc');
    const [pickModel, setPickModel] = useState(PC_MODELS[0]);
    const [stockQuery, setStockQuery] = useState('');

    const addItem = (item) => {
        onItemsChange([...items, { uid: item.serial || `legacy-${Date.now()}-${Math.random()}`, ...item }]);
    };
    const removeItem = (uid) => onItemsChange(items.filter(item => item.uid !== uid));

    const handleScan = (raw) => {
        const scan = parseScan(raw);
        const { serial } = scan;
        setQuery('');
        const device = serial ? devices?.[serial] : null;
        if (!serial) {
            setMessage({ ok: false, text: `${raw} : code illisible.` });
        } else if (items.some(item => item.serial === serial)) {
            setMessage({ ok: false, text: `${serial} : déjà dans la liste.` });
        } else if (!device) {
            setUnknown({ serial, modelName: scan.modelName, productId: scan.productId, family: scan.family, kind: scan.family ? 'pc' : null });
            return; // la fenêtre prend la main : pas de refocus sur le champ derrière
        } else if (device.status !== 'stock') {
            setMessage({ ok: false, text: `${serial} : déjà attribué à ${device.holder || '?'}.` });
        } else {
            addItem({ serial, kind: device.kind, model: device.model });
            setMessage({ ok: true, text: `${serial} ajouté · ${device.model}` });
        }
        refocus();
    };

    // redirectKeys : si le focus est resté sur une liste déroulante ou un bouton, les
    // touches de la douchette sont redirigées vers ce champ de scan.
    const { focused, refocus, inputProps } = useScanCapture({
        value: query,
        setValue: setQuery,
        onScan: handleScan,
        redirectKeys: true
    });

    // Code déjà scanné depuis la page : traité à l'ouverture du formulaire.
    useEffect(() => {
        if (initialScan) {
            handleScan(initialScan);
            onInitialScanHandled?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Appareil inconnu : on le crée puis on l'ajoute à la liste ---------------
    const createUnknown = (kind, model) => {
        onCreateDevice({ serial: unknown.serial, model, modelName: unknown.modelName, productId: unknown.productId });
        addItem({ serial: unknown.serial, kind, model });
        setMessage({ ok: true, text: `${unknown.serial} ajouté à la base · ${model}` });
        setUnknown(null);
        refocus();
    };
    const cancelUnknown = () => {
        setUnknown(null);
        refocus();
    };

    // --- Stock (choix à la main) ---------------------------------------------
    const stockCards = Object.values(devices || {})
        .filter(device => device.kind === pickKind && device.status === 'stock' && device.model === pickModel)
        .filter(device => !items.some(item => item.serial === device.serial))
        .filter(device => matchesQuery(stockQuery, [device.serial, device.modelName || '']));

    const changeKind = (kind) => {
        setPickKind(kind);
        setPickModel(kind === 'pc' ? PC_MODELS[0] : PHONE_MODEL_OPTIONS[0]);
    };

    return (
        <div className="assign-picker">
            <UnknownDeviceModal key={unknown?.serial || 'none'} unknown={unknown} onCreate={createUnknown} onCancel={cancelUnknown} />

            <label className="assign-title">Matériel à attribuer</label>

            <div className={`assign-scan${focused ? ' assign-scan-active' : ''}`}>
                <input
                    {...inputProps}
                    type="text"
                    className="assign-scan-input"
                    placeholder="Scanne un PC ou un téléphone…"
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                />
                <span className="assign-scan-status">{focused ? '● Prêt à scanner' : '○ Touche pour scanner'}</span>
            </div>
            {message && <p className={`scan-feedback ${message.ok ? 'scan-ok' : 'scan-error'}`}>{message.text}</p>}

            <ul className="assign-items">
                {items.length === 0 && <li className="assign-empty">Aucun appareil ajouté pour l'instant.</li>}
                {items.map(item => (
                    <li key={item.uid} className="assign-item">
                        <span className="assign-item-icon">{iconOf(item.kind)}</span>
                        <span className="assign-item-main">
                            <span className="assign-item-model">{item.model}</span>
                            <span className="assign-item-serial">{item.serial ? `S/N ${item.serial}` : 'sans n° de série'}</span>
                        </span>
                        <button type="button" className="assign-item-remove" onClick={() => removeItem(item.uid)} aria-label={`Retirer ${item.model}`}>
                            &times;
                        </button>
                    </li>
                ))}
            </ul>

            <button type="button" className="assign-stock-toggle" onClick={() => setStockOpen(open => !open)}>
                {stockOpen ? 'Masquer le stock' : 'Choisir dans le stock'}
            </button>

            {stockOpen && (
                <div className="assign-stock">
                    <div className="segmented-control">
                        <button type="button" className={`segment-btn ${pickKind === 'pc' ? 'active' : ''}`} onClick={() => changeKind('pc')}>PC</button>
                        <button type="button" className={`segment-btn ${pickKind === 'phone' ? 'active' : ''}`} onClick={() => changeKind('phone')}>Téléphones</button>
                    </div>
                    <select
                        className="loan-input"
                        value={pickModel}
                        onChange={(e) => { setPickModel(e.target.value); e.target.blur(); refocus(); }}
                    >
                        {(pickKind === 'pc' ? PC_MODELS : PHONE_MODEL_OPTIONS).map(model => (
                            <option key={model} value={model}>{model}</option>
                        ))}
                    </select>
                    <input
                        type="text"
                        className="loan-input"
                        placeholder="Filtrer par n° de série…"
                        value={stockQuery}
                        onChange={(e) => setStockQuery(e.target.value)}
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    {stockCards.length === 0 && <div className="search-empty">Aucun appareil scanné en stock pour ce modèle.</div>}
                    <div className="pc-card-list">
                        {stockCards.map(device => (
                            <button
                                key={device.serial}
                                type="button"
                                className="pc-card"
                                onClick={() => addItem({ serial: device.serial, kind: device.kind, model: device.model })}
                            >
                                <span className="pc-card-main">
                                    <span className="pc-card-serial">{device.serial}</span>
                                    <span className="pc-card-sub">
                                        {device.modelName || device.model} · reçu le {dateOf(device.events?.[device.events.length - 1]?.date)}
                                    </span>
                                </span>
                                <span className="pc-card-check">+</span>
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="assign-legacy"
                        onClick={() => addItem({ serial: '', kind: pickKind, model: pickModel })}
                    >
                        + Ajouter un {pickModel} sans n° de série
                    </button>
                </div>
            )}
        </div>
    );
}

// Fenêtre « appareil absent de la base » : on demande si c'est un PC ou un
// téléphone (sauf si le QR code l'indique), son modèle, puis l'état pour un PC.
function UnknownDeviceModal({ unknown, onCreate, onCancel }) {
    const [kind, setKind] = useState(null);
    const [family, setFamily] = useState(PC_FAMILIES[0]);
    const [phoneModel, setPhoneModel] = useState(PHONE_MODEL_OPTIONS[0]);

    if (!unknown) return null;
    const effectiveKind = unknown.kind || kind;
    const effectiveFamily = unknown.family || family;

    return (
        <Modal isOpen onClose={onCancel} title="Appareil absent de la base">
            <p className="unknown-text">
                <strong>{unknown.serial}</strong> n'est pas présent dans la base de données.
                Voulez-vous l'ajouter et l'associer ici ?
            </p>
            {unknown.modelName && <p className="unknown-model">Lu dans le QR code : {unknown.modelName}</p>}

            {!unknown.kind && (
                <div className="segmented-control" style={{ marginBottom: '12px' }}>
                    <button type="button" className={`segment-btn ${kind === 'pc' ? 'active' : ''}`} onClick={() => setKind('pc')}>PC</button>
                    <button type="button" className={`segment-btn ${kind === 'phone' ? 'active' : ''}`} onClick={() => setKind('phone')}>Téléphone</button>
                </div>
            )}

            {effectiveKind === 'pc' && (
                <>
                    {!unknown.family && (
                        <select className="loan-input" value={family} onChange={(e) => setFamily(e.target.value)} style={{ marginBottom: '12px' }}>
                            {PC_FAMILIES.map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                    )}
                    <p className="unknown-text">
                        {unknown.family ? `Modèle reconnu : ${unknown.family}. ` : ''}Ce PC est-il neuf ou d'occasion ?
                    </p>
                    <div className="unknown-actions">
                        {effectiveFamily !== '850 G8/G10' && (
                            <button type="button" className="unknown-yes" onClick={() => onCreate('pc', stockModelForFamily(effectiveFamily, 'Neuf'))}>
                                Ajouter en Neuf
                            </button>
                        )}
                        <button type="button" className="unknown-yes" onClick={() => onCreate('pc', stockModelForFamily(effectiveFamily, 'Occasion'))}>
                            Ajouter en Occasion
                        </button>
                        <button type="button" className="unknown-no" onClick={onCancel}>Non</button>
                    </div>
                </>
            )}

            {effectiveKind === 'phone' && (
                <>
                    <select className="loan-input" value={phoneModel} onChange={(e) => setPhoneModel(e.target.value)} style={{ marginBottom: '12px' }}>
                        {PHONE_MODEL_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <div className="unknown-actions">
                        <button type="button" className="unknown-yes" onClick={() => onCreate('phone', phoneModel)}>
                            Ajouter ce {phoneModel}
                        </button>
                        <button type="button" className="unknown-no" onClick={onCancel}>Non</button>
                    </div>
                </>
            )}

            {!effectiveKind && (
                <div className="unknown-actions">
                    <button type="button" className="unknown-no" onClick={onCancel}>Non</button>
                </div>
            )}
        </Modal>
    );
}
