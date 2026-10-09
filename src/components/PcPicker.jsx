import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { matchesQuery } from '../utils/search';
import { familyOfModel, parseScan, stockModelForFamily } from '../utils/scanParse';
import { useScanCapture } from '../hooks/useScanCapture';

const dateOf = (value) => (value ? new Date(value).toLocaleDateString() : '');

// Choix d'un PC précis parmi ceux en stock : scan du QR code (le modèle se
// sélectionne alors tout seul) ou appui sur une carte de la liste du modèle choisi.
export default function PcPicker({ devices, pcType, onModelChange, selected, onSelect, onCreateDevice }) {
    const [query, setQuery] = useState('');
    const [message, setMessage] = useState(null); // { ok, text }

    const selectedDevice = selected ? devices?.[selected] : null;
    const forModel = Object.values(devices || {})
        .filter(device => device.kind === 'pc' && device.status === 'stock' && device.model === pcType);
    const visible = forModel.filter(device =>
        matchesQuery(query, [device.serial, device.modelName || '', device.productId || ''])
    );

    // PC scanné qui n'est pas dans la base : on propose de l'ajouter et de l'associer ici.
    const [unknown, setUnknown] = useState(null); // { serial, family, modelName, productId }

    const handleScan = (raw) => {
        const scan = parseScan(raw);
        const { serial } = scan;
        setQuery('');
        const device = serial ? devices?.[serial] : null;
        if (!serial) {
            setMessage({ ok: false, text: `${raw} : code illisible.` });
        } else if (device && device.kind !== 'pc') {
            setMessage({ ok: false, text: `${serial} : ce n'est pas un PC.` });
        } else if (!device) {
            setUnknown({
                serial,
                family: scan.family || familyOfModel(pcType),
                modelName: scan.modelName,
                productId: scan.productId,
                recognized: Boolean(scan.family)
            });
            return; // le pop-up prend la main : pas de refocus sur le champ derrière
        } else if (device.status !== 'stock') {
            setMessage({ ok: false, text: `${serial} : déjà attribué à ${device.holder || '?'}.` });
        } else {
            onModelChange(device.model);
            onSelect(serial);
            setMessage({ ok: true, text: `${serial} sélectionné · ${device.model}` });
        }
        refocus();
    };

    const { focused, refocus, inputProps } = useScanCapture({ value: query, setValue: setQuery, onScan: handleScan });

    // Ajoute le PC inconnu à la base (avec l'état choisi) puis le sélectionne.
    const createAndSelect = (condition) => {
        const model = stockModelForFamily(unknown.family, condition);
        onCreateDevice({ serial: unknown.serial, model, modelName: unknown.modelName, productId: unknown.productId });
        onModelChange(model);
        onSelect(unknown.serial);
        setMessage({ ok: true, text: `${unknown.serial} ajouté à la base et sélectionné · ${model}` });
        setUnknown(null);
        refocus();
    };

    const cancelUnknown = () => {
        setUnknown(null);
        refocus();
    };

    useEffect(() => {
        refocus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="form-group pc-picker">
            <Modal isOpen={Boolean(unknown)} onClose={cancelUnknown} title="PC absent de la base">
                {unknown && (
                    <div>
                        <p className="unknown-text">
                            Le PC <strong>{unknown.serial}</strong> n'est pas présent dans la base de données.
                            Voulez-vous l'ajouter et l'associer ici ?
                        </p>
                        <p className="unknown-model">
                            Modèle : {unknown.family}
                            {unknown.modelName ? ` (${unknown.modelName})` : ''}
                            {!unknown.recognized ? ' — non reconnu, repris du type de PC choisi' : ''}
                        </p>
                        <p className="unknown-text">Ce PC est-il neuf ou d'occasion ?</p>
                        <div className="unknown-actions">
                            {unknown.family !== '850 G8/G10' && (
                                <button type="button" className="unknown-yes" onClick={() => createAndSelect('Neuf')}>
                                    Oui, ajouter en Neuf
                                </button>
                            )}
                            <button type="button" className="unknown-yes" onClick={() => createAndSelect('Occasion')}>
                                Oui, ajouter en Occasion
                            </button>
                            <button type="button" className="unknown-no" onClick={cancelUnknown}>Non</button>
                        </div>
                    </div>
                )}
            </Modal>
            <label>PC remis (n° de série)</label>
            <input
                {...inputProps}
                type="text"
                className={`loan-input full-width scan-input${focused ? ' scan-input-active' : ''}`}
                placeholder="Scanne le PC ou cherche un n°…"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
            />
            <p className={`scan-status ${focused ? 'scan-status-ready' : 'scan-status-idle'}`}>
                {focused ? '● Prêt à scanner' : '○ Touche le champ pour scanner'}
            </p>
            {message && <p className={`scan-feedback ${message.ok ? 'scan-ok' : 'scan-error'}`}>{message.text}</p>}

            {selectedDevice && (
                <div className="pc-selected">
                    <div>
                        <span className="pc-selected-label">Sélectionné</span>
                        <span className="pc-card-serial">{selectedDevice.serial}</span>
                        <span className="pc-card-sub">{selectedDevice.model}</span>
                    </div>
                    <button type="button" onClick={() => { onSelect(''); setMessage(null); }}>Changer</button>
                </div>
            )}

            <div className="pc-list-header">
                {forModel.length} {pcType} en stock avec n° de série
            </div>
            {forModel.length === 0 && (
                <div className="search-empty">Aucun PC scanné en stock pour ce modèle. Scanne un PC pour choisir son modèle.</div>
            )}
            {forModel.length > 0 && visible.length === 0 && <div className="search-empty">Aucun PC trouvé.</div>}
            <div className="pc-card-list">
                {visible.map(device => (
                    <button
                        key={device.serial}
                        type="button"
                        className={`pc-card${device.serial === selected ? ' pc-card-selected' : ''}`}
                        onClick={() => { onSelect(device.serial === selected ? '' : device.serial); setMessage(null); }}
                    >
                        <span className="pc-card-main">
                            <span className="pc-card-serial">{device.serial}</span>
                            <span className="pc-card-sub">
                                {device.modelName || device.model} · reçu le {dateOf(device.events?.[device.events.length - 1]?.date)}
                            </span>
                        </span>
                        <span className="pc-card-check">{device.serial === selected ? '✓' : ''}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
