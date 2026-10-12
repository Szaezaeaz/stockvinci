import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { matchesQuery } from '../utils/search';
import { familyOfModel, parseScan, stockModelForFamily } from '../utils/scanParse';
import { useScanCapture } from '../hooks/useScanCapture';

const dateOf = (value) => (value ? new Date(value).toLocaleDateString() : '');

const TEXTS = {
    pc: {
        title: 'PC remis (n° de série)',
        placeholder: 'Scanne un PC ou cherche un n°…',
        noun: 'PC',
        notThis: "ce n'est pas un PC"
    },
    phone: {
        title: 'Téléphone remis (n° de série / IMEI)',
        placeholder: 'Scanne le téléphone ou cherche un n°…',
        noun: 'téléphone',
        notThis: "ce n'est pas un téléphone"
    }
};

// Choix d'appareils précis parmi ceux en stock : scan (le modèle se sélectionne
// alors tout seul) ou appui sur une carte de la liste du modèle choisi.
// kind : 'pc' ou 'phone' ; multi : plusieurs appareils à la fois (PC).
// selected : tableau de n° de série ; onChange(nouveauTableau).
export default function DevicePicker({
    devices,
    kind,
    model,
    onModelChange,
    selected,
    onChange,
    onCreateDevice,
    multi = false,
    initialScan,
    onInitialScanHandled,
    redirectKeys = false,
    focusKey = 0
}) {
    const text = TEXTS[kind];
    const [query, setQuery] = useState('');
    const [message, setMessage] = useState(null); // { ok, text }
    // Appareil scanné qui n'est pas dans la base : on propose de l'ajouter et de l'associer.
    const [unknown, setUnknown] = useState(null); // { serial, family, modelName, productId, recognized }

    const forModel = Object.values(devices || {})
        .filter(device => device.kind === kind && device.status === 'stock' && device.model === model);
    const visible = forModel.filter(device =>
        matchesQuery(query, [device.serial, device.modelName || '', device.productId || ''])
    );

    const select = (serial) => {
        onChange(multi ? [...selected, serial] : [serial]);
    };

    const toggle = (serial) => {
        if (selected.includes(serial)) onChange(selected.filter(s => s !== serial));
        else select(serial);
        setMessage(null);
    };

    const handleScan = (raw) => {
        const scan = parseScan(raw);
        const { serial } = scan;
        setQuery('');
        const device = serial ? devices?.[serial] : null;
        if (!serial) {
            setMessage({ ok: false, text: `${raw} : code illisible.` });
        } else if (device && device.kind !== kind) {
            setMessage({ ok: false, text: `${serial} : ${text.notThis}.` });
        } else if (!device) {
            setUnknown({
                serial,
                family: scan.family || familyOfModel(model),
                modelName: scan.modelName,
                productId: scan.productId,
                recognized: Boolean(scan.family)
            });
            return; // la fenêtre prend la main : pas de refocus sur le champ derrière
        } else if (device.status !== 'stock') {
            setMessage({ ok: false, text: `${serial} : déjà attribué à ${device.holder || '?'}.` });
        } else if (selected.includes(serial)) {
            setMessage({ ok: false, text: `${serial} : déjà sélectionné.` });
        } else {
            onModelChange(device.model);
            select(serial);
            setMessage({ ok: true, text: `${serial} ajouté · ${device.model}` });
        }
        refocus();
    };

    // redirectKeys : si le focus est resté sur une liste déroulante (modèle) ou un
    // bouton, la douchette y tapait son code (la liste change de modèle toute seule) ;
    // les touches sont alors redirigées vers ce champ de scan.
    const { focused, refocus, inputProps } = useScanCapture({
        value: query,
        setValue: setQuery,
        onScan: handleScan,
        redirectKeys
    });

    // Le parent change focusKey après un choix de modèle : le champ de scan reprend la main.
    useEffect(() => {
        if (focusKey) refocus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusKey]);

    // Ajoute l'appareil inconnu à la base (PC : avec l'état choisi) puis le sélectionne.
    const createAndSelect = (condition) => {
        const newModel = kind === 'pc' ? stockModelForFamily(unknown.family, condition) : model;
        onCreateDevice({ serial: unknown.serial, model: newModel, modelName: unknown.modelName, productId: unknown.productId });
        onModelChange(newModel);
        select(unknown.serial);
        setMessage({ ok: true, text: `${unknown.serial} ajouté à la base et sélectionné · ${newModel}` });
        setUnknown(null);
        refocus();
    };

    const cancelUnknown = () => {
        setUnknown(null);
        refocus();
    };

    // À l'ouverture : soit on traite le code déjà scanné depuis la page, soit on
    // met le champ de scan au premier plan.
    useEffect(() => {
        if (initialScan) {
            handleScan(initialScan);
            onInitialScanHandled?.();
        } else if (kind === 'pc') {
            refocus();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="form-group pc-picker">
            <Modal isOpen={Boolean(unknown)} onClose={cancelUnknown} title={`${kind === 'pc' ? 'PC' : 'Téléphone'} absent de la base`}>
                {unknown && (
                    <div>
                        <p className="unknown-text">
                            Le {text.noun} <strong>{unknown.serial}</strong> n'est pas présent dans la base de données.
                            Voulez-vous l'ajouter et l'associer ici ?
                        </p>
                        <p className="unknown-model">
                            Modèle : {kind === 'pc' ? unknown.family : model}
                            {unknown.modelName ? ` (${unknown.modelName})` : ''}
                            {kind === 'pc' && !unknown.recognized ? ' — non reconnu, repris du type de PC choisi' : ''}
                            {kind === 'phone' ? ' — repris du modèle choisi' : ''}
                        </p>
                        {kind === 'pc' ? (
                            <>
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
                            </>
                        ) : (
                            <div className="unknown-actions">
                                <button type="button" className="unknown-yes" onClick={() => createAndSelect()}>
                                    Oui, ajouter
                                </button>
                                <button type="button" className="unknown-no" onClick={cancelUnknown}>Non</button>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <label>{text.title}</label>
            <input
                {...inputProps}
                type="text"
                className={`loan-input full-width scan-input${focused ? ' scan-input-active' : ''}`}
                placeholder={text.placeholder}
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

            {selected.length > 0 && (
                <div className="pc-selected-list">
                    <span className="pc-selected-label">Sélectionné{selected.length > 1 ? `s (${selected.length})` : ''}</span>
                    {selected.map(serial => (
                        <div key={serial} className="pc-selected">
                            <div>
                                <span className="pc-card-serial">{serial}</span>
                                <span className="pc-card-sub">{devices?.[serial]?.model || ''}</span>
                            </div>
                            <button type="button" onClick={() => { onChange(selected.filter(s => s !== serial)); setMessage(null); }}>
                                Retirer
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="pc-list-header">
                {forModel.length} {model} en stock avec n° de série
            </div>
            {forModel.length === 0 && (
                <div className="search-empty">Aucun {text.noun} scanné en stock pour ce modèle. Scanne-en un pour choisir son modèle.</div>
            )}
            {forModel.length > 0 && visible.length === 0 && <div className="search-empty">Aucun {text.noun} trouvé.</div>}
            <div className="pc-card-list">
                {visible.map(device => {
                    const isSelected = selected.includes(device.serial);
                    return (
                        <button
                            key={device.serial}
                            type="button"
                            className={`pc-card${isSelected ? ' pc-card-selected' : ''}`}
                            onClick={() => toggle(device.serial)}
                        >
                            <span className="pc-card-main">
                                <span className="pc-card-serial">{device.serial}</span>
                                <span className="pc-card-sub">
                                    {device.modelName || device.model} · reçu le {dateOf(device.events?.[device.events.length - 1]?.date)}
                                </span>
                            </span>
                            <span className="pc-card-check">{isSelected ? '✓' : ''}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
