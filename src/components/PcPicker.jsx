import React, { useEffect, useState } from 'react';
import { matchesQuery } from '../utils/search';
import { parseScan } from '../utils/scanParse';
import { useScanCapture } from '../hooks/useScanCapture';

const dateOf = (value) => (value ? new Date(value).toLocaleDateString() : '');

// Choix d'un PC précis parmi ceux en stock : scan du QR code (le modèle se
// sélectionne alors tout seul) ou appui sur une carte de la liste du modèle choisi.
export default function PcPicker({ devices, pcType, onModelChange, selected, onSelect }) {
    const [query, setQuery] = useState('');
    const [message, setMessage] = useState(null); // { ok, text }

    const selectedDevice = selected ? devices?.[selected] : null;
    const forModel = Object.values(devices || {})
        .filter(device => device.kind === 'pc' && device.status === 'stock' && device.model === pcType);
    const visible = forModel.filter(device =>
        matchesQuery(query, [device.serial, device.modelName || '', device.productId || ''])
    );

    const handleScan = (raw) => {
        const { serial } = parseScan(raw);
        setQuery('');
        const device = serial ? devices?.[serial] : null;
        if (!device || device.kind !== 'pc') {
            setMessage({ ok: false, text: `${serial || raw} : PC inconnu. Réceptionne-le d'abord dans Ajout → Scanner.` });
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

    useEffect(() => {
        refocus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="form-group pc-picker">
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
