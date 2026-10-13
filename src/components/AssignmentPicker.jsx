import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import ModelPicker from './ModelPicker';
import { TRACKED_MODELS } from '../config/trackedModels';
import { matchesQuery } from '../utils/search';
import { parseScan } from '../utils/scanParse';
import {
    aliasKeyToLearn, conditionOfStockKey, deviceModelLabel, exactModelFor, exactModelFromStockKey, isOccasionOnly, kindOfModel,
    modelLabel, modelOf, stockKeyOf
} from '../utils/models';
import { useScanCapture } from '../hooks/useScanCapture';

// Le stock peut compter des centaines d'appareils : on n'en affiche que les
// premiers, la recherche sert à trouver les autres.
const MAX_STOCK_SHOWN = 30;

const iconOf = (kind) => (kind === 'phone' ? '📱' : '💻');

// Nom affiché d'un appareil de la liste, puis son n° de série et son état.
const itemLabel = (item) => deviceModelLabel(item);

function itemDetail(item) {
    const condition = conditionOfStockKey(item.model);
    return `${item.serial ? `S/N ${item.serial}` : 'sans n° de série'}${condition ? ` · ${condition}` : ''}`;
}

// Matériel à attribuer : un seul champ de scan pour les PC et les téléphones, la
// liste de ce qui est ajouté, et (repliée) la liste du stock pour choisir à la main.
// items : [{ uid, kind: 'pc' | 'phone', model (ligne de stock), exactModel, serial }]
// (serial vide = stock ancien non suivi).
export default function AssignmentPicker({ devices, stock, items, onItemsChange, onCreateDevice, initialScan, onInitialScanHandled }) {
    const [query, setQuery] = useState('');
    const [message, setMessage] = useState(null); // { ok, text }
    const [unknown, setUnknown] = useState(null); // appareil scanné absent de la base
    const [stockOpen, setStockOpen] = useState(false);
    const [stockQuery, setStockQuery] = useState('');

    const addItem = (item) => {
        onItemsChange([...items, { uid: item.serial || `legacy-${Date.now()}-${Math.random()}`, ...item }]);
    };
    const removeItem = (uid) => onItemsChange(items.filter(item => item.uid !== uid));
    const addDevice = (device) => {
        addItem({ serial: device.serial, kind: device.kind, model: device.model, exactModel: device.exactModel });
    };

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
            setUnknown(scan);
            return; // la fenêtre prend la main : pas de refocus sur le champ derrière
        } else if (device.status !== 'stock') {
            setMessage({ ok: false, text: `${serial} : déjà attribué à ${device.holder || '?'}.` });
        } else {
            addDevice(device);
            setMessage({ ok: true, text: `${serial} ajouté · ${deviceModelLabel(device)}` });
        }
        refocus();
    };

    // redirectKeys : si le focus est resté sur un bouton, les touches de la douchette
    // sont redirigées vers ce champ de scan.
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
    // chosen : modèle de l'appli choisi (ou reconnu) pour cet appareil.
    const createUnknown = (chosen, condition) => {
        const model = stockKeyOf(chosen, condition);
        const exactModel = exactModelFor(chosen, unknown.model) || undefined;
        onCreateDevice({
            serial: unknown.serial,
            model,
            exactModel,
            modelName: unknown.modelName,
            productId: unknown.productId,
            learnKey: unknown.modelName && !unknown.model ? aliasKeyToLearn(unknown) : '',
            learnModel: chosen
        });
        addItem({ serial: unknown.serial, kind: kindOfModel(chosen), model, exactModel });
        setMessage({ ok: true, text: `${unknown.serial} ajouté à la base · ${modelLabel(chosen)}` });
        setUnknown(null);
        refocus();
    };
    const cancelUnknown = () => {
        setUnknown(null);
        refocus();
    };

    // --- Stock (choix à la main) ---------------------------------------------
    const inStock = stockOpen
        ? Object.values(devices || {}).filter(device => device.status === 'stock' && !items.some(item => item.serial === device.serial))
        : [];
    const stockCards = inStock.filter(device =>
        matchesQuery(stockQuery, [device.serial, device.exactModel || '', device.model, device.modelName || ''])
    );
    // Lignes de l'accueil qui comptent encore des unités sans n° de série.
    const untracked = stockOpen
        ? [...TRACKED_MODELS]
            .map(model => ({
                model,
                count: (stock?.[model] || 0)
                    - Object.values(devices || {}).filter(device => device.status === 'stock' && device.model === model).length
                    - items.filter(item => !item.serial && item.model === model).length
            }))
            .filter(({ model, count }) => count > 0 && matchesQuery(stockQuery, [model]))
        : [];

    return (
        <div className="assign-picker">
            <UnknownDeviceModal key={unknown?.serial || 'none'} unknown={unknown} devices={devices} onCreate={createUnknown} onCancel={cancelUnknown} />

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
                            <span className="assign-item-model">{itemLabel(item)}</span>
                            <span className="assign-item-serial">{itemDetail(item)}</span>
                        </span>
                        <button type="button" className="assign-item-remove" onClick={() => removeItem(item.uid)} aria-label={`Retirer ${itemLabel(item)}`}>
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
                    <input
                        type="text"
                        className="loan-input"
                        placeholder="Chercher un modèle ou un n° de série…"
                        value={stockQuery}
                        onChange={(e) => setStockQuery(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                    />
                    {stockCards.length === 0 && untracked.length === 0 && (
                        <div className="search-empty">{stockQuery ? 'Aucun appareil trouvé en stock.' : 'Aucun appareil en stock.'}</div>
                    )}
                    {stockCards.length > MAX_STOCK_SHOWN && (
                        <p className="list-count">{MAX_STOCK_SHOWN} affichés sur {stockCards.length} : précise la recherche pour trouver les autres.</p>
                    )}
                    <div className="pc-card-list">
                        {stockCards.slice(0, MAX_STOCK_SHOWN).map(device => (
                            <button key={device.serial} type="button" className="pc-card" onClick={() => addDevice(device)}>
                                <span className="pc-card-main">
                                    <span className="pc-card-serial">{device.serial}</span>
                                    <span className="pc-card-sub">
                                        {iconOf(device.kind)} {deviceModelLabel(device)}
                                        {conditionOfStockKey(device.model) ? ` · ${conditionOfStockKey(device.model)}` : ''}
                                    </span>
                                </span>
                                <span className="pc-card-check">+</span>
                            </button>
                        ))}
                    </div>
                    {untracked.map(({ model, count }) => (
                        <button
                            key={model}
                            type="button"
                            className="assign-legacy"
                            onClick={() => addItem({ serial: '', kind: kindOfModel(model), model, exactModel: exactModelFromStockKey(model) || undefined })}
                        >
                            + {model} sans n° de série ({count} en stock)
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// Fenêtre « appareil absent de la base » : le modèle vient du QR code quand il est
// reconnu, sinon on le choisit ; puis, pour un PC, son état.
function UnknownDeviceModal({ unknown, devices, onCreate, onCancel }) {
    const [model, setModel] = useState(unknown?.model ? modelOf(unknown.model) : '');

    if (!unknown) return null;
    const kind = model ? kindOfModel(model) : null;

    return (
        <Modal isOpen onClose={onCancel} title="Appareil absent de la base">
            <p className="unknown-text">
                <strong>{unknown.serial}</strong> n'est pas présent dans la base de données.
                Voulez-vous l'ajouter et l'associer ici ?
            </p>
            {unknown.modelName && (
                <p className="unknown-model">
                    Lu dans le QR code : {unknown.modelName}
                    {!unknown.model && ' — modèle non reconnu, à choisir ci-dessous'}
                </p>
            )}

            <div className="unknown-picker">
                <ModelPicker value={model} onChange={setModel} devices={devices} suggestions={unknown.candidates} />
            </div>

            {kind === 'pc' && <p className="unknown-text">Ce PC est-il neuf ou d'occasion ?</p>}

            <div className="unknown-actions">
                {kind === 'pc' && !isOccasionOnly(model) && (
                    <button type="button" className="unknown-yes" onClick={() => onCreate(model, 'Neuf')}>Ajouter en Neuf</button>
                )}
                {kind === 'pc' && (
                    <button type="button" className="unknown-yes" onClick={() => onCreate(model, 'Occasion')}>Ajouter en Occasion</button>
                )}
                {kind === 'phone' && (
                    <button type="button" className="unknown-yes" onClick={() => onCreate(model, null)}>
                        Ajouter ce {modelLabel(model)}
                    </button>
                )}
                <button type="button" className="unknown-no" onClick={onCancel}>Non</button>
            </div>
        </Modal>
    );
}
