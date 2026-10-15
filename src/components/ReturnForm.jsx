import React, { useMemo, useState } from 'react';
import ModelPicker from './ModelPicker';
import PersonNameFields from './PersonNameFields';
import { PHONE_CASE_INFO } from '../config/phoneAccessories';
import { RETURN_ITEMS } from '../config/secondaryItems';
import { useScanCapture } from '../hooks/useScanCapture';
import { parseScan } from '../utils/scanParse';
import { fullName, nameKey, splitName } from '../utils/person';
import {
    aliasKeyToLearn, conditionOfStockKey, deviceFullName, exactModelFor, kindOfModel, modelLabel, modelOf, stockKeyOf
} from '../utils/models';

const KINDS = {
    pc: { title: 'Retour PC', icon: '💻', one: 'PC', entersAs: 'stock Occasion' },
    phone: { title: 'Retour Téléphone', icon: '📱', one: 'téléphone', entersAs: 'stock' }
};

const plural = (count, word) => `${count} ${word}${count > 1 ? 's' : ''}`;

// Une section "Retour PC" ou "Retour Téléphone" : le matériel déjà attribué à la
// personne (à cocher), les appareils scannés en plus, et le champ de scan.
function ReturnSection({ kind, isOpen, onToggle, listed, isPicked, onPick, added, onModel, onRemove, devices, scan, message, hint }) {
    const { title, icon } = KINDS[kind];
    return (
        <div className="return-section">
            <label className="return-section-toggle">
                <input type="checkbox" checked={isOpen} onChange={(e) => onToggle(e.target.checked)} />
                {title}
            </label>

            {isOpen && (
                <div className="return-section-body">
                    {listed.length > 0 && (
                        <ul className="return-devices">
                            {listed.map(device => {
                                const condition = conditionOfStockKey(device.model);
                                const on = isPicked(device.serial);
                                return (
                                    <li key={device.serial}>
                                        <label className={`return-device${on ? ' return-device-on' : ''}`}>
                                            <input type="checkbox" checked={on} onChange={() => onPick(device.serial)} />
                                            <span className="assign-item-icon">{icon}</span>
                                            <span className="assign-item-main">
                                                <span className="assign-item-model">{deviceFullName(device)}</span>
                                                <span className="assign-item-serial">S/N {device.serial}{condition ? ` · ${condition}` : ''}</span>
                                            </span>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {listed.length === 0 && <p className="scan-hint">{hint}</p>}

                    {added.length > 0 && (
                        <ul className="return-devices">
                            {added.map(entry => (
                                <li key={entry.serial} className="return-added">
                                    <span className="assign-item-icon">{icon}</span>
                                    <span className="assign-item-main">
                                        {entry.known ? (
                                            <span className="assign-item-model">{deviceFullName(devices[entry.serial])}</span>
                                        ) : (
                                            <ModelPicker
                                                compact
                                                kind={kind}
                                                value={entry.model || ''}
                                                suggestions={entry.candidates}
                                                devices={devices}
                                                placeholder="Modèle à choisir"
                                                onChange={(model) => onModel(entry.serial, model)}
                                            />
                                        )}
                                        <span className="assign-item-serial">S/N {entry.serial}</span>
                                        <span className="return-note">
                                            {entry.known
                                                ? `Attribué à ${entry.holder} : il sera retiré de sa fiche.`
                                                : `Nouveau : entre en ${KINDS[kind].entersAs}.`}
                                        </span>
                                    </span>
                                    <button type="button" className="assign-item-remove" onClick={() => onRemove(entry.serial)} aria-label={`Retirer ${entry.serial}`}>
                                        &times;
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className={`assign-scan${scan.focused ? ' assign-scan-active' : ''}`}>
                        <input
                            {...scan.inputProps}
                            type="text"
                            className="assign-scan-input"
                            placeholder={kind === 'pc' ? 'Scanner un PC…' : 'Scanner un téléphone…'}
                            inputMode="text"
                            autoCapitalize="characters"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                        />
                        <span className="assign-scan-status">{scan.focused ? '● Prêt à scanner' : '○ Touche pour scanner'}</span>
                    </div>
                    {message && <p className={`scan-feedback ${message.ok ? 'scan-ok' : 'scan-error'}`}>{message.text}</p>}
                </div>
            )}
        </div>
    );
}

const NO_CHOICES = { picked: {}, items: {}, open: {}, phoneCase: null };

// Ouvert depuis une attribution ("Matériel rendu" de l'onglet Attribué) : on ne coche que
// ce qu'elle contient, car la personne peut avoir d'autres attributions qui restent chez elle.
function initialChoices(personKey, devices, preselect) {
    if (!personKey || !preselect) return { key: '', ...NO_CHOICES };
    const serials = new Set(preselect.serials || []);
    const items = preselect.items || [];
    const picked = {};
    for (const device of Object.values(devices || {})) {
        if (device.status === 'assigned' && nameKey(device.holder) === personKey) picked[device.serial] = serials.has(device.serial);
    }
    return {
        key: personKey,
        open: {},
        picked,
        items: Object.fromEntries(RETURN_ITEMS.map(item => [item.id, items.includes(item.id)])),
        phoneCase: items.some(item => /^(Coque|Vitre)/.test(item))
    };
}

// Retour de matériel : on indique la personne, ce qui lui est attribué apparaît
// déjà coché (on décoche ce qu'elle garde), puis le matériel secondaire. Si la
// personne ou l'appareil n'existe pas encore dans l'appli (ou n'est pas attribué à
// cette personne), on le scanne : il entre en stock (Occasion pour un PC).
// initialName : "NOM Prénom" à préremplir ; preselect : { serials, items } à cocher d'office
// (sinon tout ce que la personne a est coché).
export default function ReturnForm({ devices, loans, onSubmit, onDone, initialName = '', preselect = null }) {
    const [lastName, setLastName] = useState(() => splitName(initialName).last);
    const [firstName, setFirstName] = useState(() => splitName(initialName).first);
    // Choix modifiés à la main pour la personne saisie (un autre nom les écarte). Ce qui
    // n'est pas modifié suit ce que la personne a déjà : tout est coché d'office.
    const [choices, setChoices] = useState(() => {
        const { last, first } = splitName(initialName);
        return initialChoices(last && first ? nameKey(fullName(last, first)) : '', devices, preselect);
    });
    const [extras, setExtras] = useState([]); // appareils scannés en plus
    const [scanValues, setScanValues] = useState({ pc: '', phone: '' });
    const [messages, setMessages] = useState({ pc: null, phone: null });

    const name = fullName(lastName, firstName);
    const personKey = lastName.trim() && firstName.trim() ? nameKey(name) : '';

    // Ce que l'appli sait de la personne : son matériel attribué et ce qu'on lui a donné.
    const person = useMemo(() => {
        if (!personKey) return null;
        const mine = Object.values(devices || {}).filter(device => device.status === 'assigned' && nameKey(device.holder) === personKey);
        const given = new Set();
        let known = mine.length > 0;
        for (const loan of loans || []) {
            if (nameKey(loan.name || loan.recipient) !== personKey) continue;
            known = true;
            (loan.items || []).forEach(item => given.add(item));
        }
        const byName = (a, b) => deviceFullName(a).localeCompare(deviceFullName(b), 'fr') || a.serial.localeCompare(b.serial);
        return {
            known,
            given,
            pc: mine.filter(device => device.kind === 'pc').sort(byName),
            phone: mine.filter(device => device.kind === 'phone').sort(byName)
        };
    }, [personKey, devices, loans]);

    // --- Choix de l'utilisateur, par rapport à ce que la personne a déjà ---------------
    const own = choices.key === personKey ? choices : NO_CHOICES;
    const patchChoices = (patch) => setChoices(prev => {
        const base = prev.key === personKey ? prev : { key: personKey, ...NO_CHOICES };
        return { ...base, ...patch(base) };
    });

    const attributed = (kind) => person?.[kind] || [];
    const sectionOpen = (kind) => own.open[kind] ?? (person ? person[kind].length > 0 || !person.known : false);
    const isPicked = (serial) => own.picked[serial] ?? true; // le matériel attribué est coché d'office
    const isItemOn = (id) => own.items[id] ?? Boolean(person?.given.has(id));
    const setPicked = (serial, on) => patchChoices(base => ({ picked: { ...base.picked, [serial]: on } }));
    const setItem = (id, on) => patchChoices(base => ({ items: { ...base.items, [id]: on } }));

    // --- Scan d'un appareil -------------------------------------------------------
    const say = (kind, ok, text) => setMessages(prev => ({ ...prev, [kind]: { ok, text } }));

    const handleScan = (kind, raw) => {
        setScanValues(prev => ({ ...prev, [kind]: '' }));
        const scan = parseScan(raw);
        const { serial } = scan;
        const { one } = KINDS[kind];
        if (!serial) return say(kind, false, `${raw} : code illisible.`);
        if (extras.some(entry => entry.serial === serial)) return say(kind, false, `${serial} : déjà dans la liste.`);

        const known = devices?.[serial];
        if (known) {
            if (known.kind !== kind) {
                return say(kind, false, `${serial} est ${known.kind === 'phone' ? 'un téléphone' : 'un PC'} : utilise « ${KINDS[known.kind].title} ».`);
            }
            if (known.status === 'stock') return say(kind, false, `${serial} : déjà en stock.`);
            if (personKey && nameKey(known.holder) === personKey) {
                setPicked(serial, true);
                return say(kind, true, `${serial} coché · ${deviceFullName(known)}`);
            }
            setExtras(prev => [...prev, { serial, kind, known: true, holder: known.holder || '?' }]);
            return say(kind, true, `${serial} ajouté (attribué à ${known.holder || '?'}).`);
        }

        // Appareil inconnu : modèle lu dans le QR code d'un PC, sinon à choisir.
        const fromQr = Boolean(scan.modelName);
        const recognized = scan.model && kindOfModel(scan.model) === kind ? modelOf(scan.model) : '';
        setExtras(prev => [...prev, {
            serial,
            kind,
            known: false,
            model: recognized,
            qrModel: recognized ? scan.model : null,
            modelName: scan.modelName,
            productId: scan.productId,
            candidates: scan.candidates,
            learnKey: fromQr && !scan.model ? aliasKeyToLearn(scan) : ''
        }]);
        return say(kind, true, recognized
            ? `${serial} ajouté · ${modelLabel(recognized)}`
            : `${serial} ajouté : choisis le modèle du ${one}.`);
    };

    const pcScan = useScanCapture({
        value: scanValues.pc,
        setValue: (value) => setScanValues(prev => ({ ...prev, pc: value })),
        onScan: (raw) => handleScan('pc', raw)
    });
    const phoneScan = useScanCapture({
        value: scanValues.phone,
        setValue: (value) => setScanValues(prev => ({ ...prev, phone: value })),
        onScan: (raw) => handleScan('phone', raw)
    });

    const setExtraModel = (serial, model) => setExtras(prev => prev.map(entry => (entry.serial === serial ? { ...entry, model } : entry)));
    const removeExtra = (serial) => setExtras(prev => prev.filter(entry => entry.serial !== serial));

    // --- Ce qui est rendu ---------------------------------------------------------
    const returnedOf = (kind) => (sectionOpen(kind)
        ? { listed: attributed(kind).filter(device => isPicked(device.serial)), added: extras.filter(entry => entry.kind === kind) }
        : { listed: [], added: [] });
    const pcs = returnedOf('pc');
    const phones = returnedOf('phone');
    const returnedCount = pcs.listed.length + pcs.added.length + phones.listed.length + phones.added.length;
    const itemNames = RETURN_ITEMS.map(item => item.id).filter(isItemOn);
    const missingModel = [...pcs.added, ...phones.added].some(entry => !entry.known && !entry.model);

    // Coque et vitre : proposées quand un téléphone rendu en a en stock, cochées d'office
    // si la personne les avait reçues.
    const phoneStockKeys = [
        ...phones.listed.map(device => device.model),
        ...phones.added.map(entry => (entry.known ? devices[entry.serial].model : entry.model ? stockKeyOf(entry.model) : ''))
    ];
    const caseInfos = phoneStockKeys.map(key => PHONE_CASE_INFO[key]).filter(Boolean);
    const caseLabel = caseInfos.length > 0 && caseInfos.every(info => info.bundled) ? 'Coque + Vitre' : 'Coque et Vitre';
    const caseGiven = caseInfos.some(info => person?.given.has(info.bundled ? info.comboItem : info.caseItem));
    const caseOn = caseInfos.length > 0 && (own.phoneCase ?? caseGiven);

    const count = returnedCount + itemNames.length + (caseOn ? 1 : 0);
    const blocker = !personKey
        ? 'Indique le NOM et le prénom'
        : missingModel
            ? 'Choisis le modèle de l’appareil scanné'
            : count === 0
                ? 'Sélectionne le matériel rendu'
                : '';

    const handleSubmit = (e) => {
        e.preventDefault();
        if (blocker) return;
        const listed = [...pcs.listed, ...phones.listed].map(device => ({ serial: device.serial, kind: device.kind }));
        const added = [...pcs.added, ...phones.added].map(entry => (entry.known
            ? { serial: entry.serial, kind: entry.kind }
            : {
                serial: entry.serial,
                kind: entry.kind,
                model: entry.kind === 'pc' ? stockKeyOf(entry.model, 'Occasion') : stockKeyOf(entry.model),
                exactModel: exactModelFor(entry.model, entry.qrModel) || undefined,
                modelName: entry.modelName,
                productId: entry.productId,
                learnKey: entry.learnKey,
                learnModel: entry.model
            }));
        onSubmit(name, { returned: [...listed, ...added], items: itemNames, phoneCase: caseOn });
        onDone();
    };

    // --- Tout sélectionner / désélectionner : tout ce qui est attribué à la personne ---
    const myDevices = person ? [...person.pc, ...person.phone] : [];
    const givenItems = person ? RETURN_ITEMS.map(item => item.id).filter(id => person.given.has(id)) : [];
    const allSelected = myDevices.length + givenItems.length > 0
        && myDevices.every(device => isPicked(device.serial)) && givenItems.every(isItemOn);
    const toggleAll = () => {
        const on = !allSelected;
        patchChoices(base => ({
            picked: { ...base.picked, ...Object.fromEntries(myDevices.map(device => [device.serial, on])) },
            items: { ...base.items, ...Object.fromEntries(givenItems.map(id => [id, on])) },
            open: on ? { pc: person.pc.length > 0 ? true : base.open.pc, phone: person.phone.length > 0 ? true : base.open.phone } : base.open,
            phoneCase: on ? null : false
        }));
    };

    const summary = person?.known
        ? [
            person.pc.length > 0 && `${person.pc.length} PC`,
            person.phone.length > 0 && plural(person.phone.length, 'téléphone'),
            givenItems.length > 0 && `${givenItems.length} matériel secondaire`
        ].filter(Boolean).join(' · ') || 'aucun matériel enregistré'
        : '';

    const hintFor = (kind) => {
        const { one, entersAs } = KINDS[kind];
        const prefix = person?.known ? `Aucun ${one} enregistré pour cette personne. ` : '';
        return `${prefix}Scanne le ${one} rapporté : il entrera en ${entersAs}.`;
    };

    const sectionProps = (kind, scan, returned) => ({
        kind,
        isOpen: sectionOpen(kind),
        onToggle: (checked) => patchChoices(base => ({ open: { ...base.open, [kind]: checked } })),
        listed: attributed(kind),
        isPicked,
        onPick: (serial) => setPicked(serial, !isPicked(serial)),
        added: returned.added,
        onModel: setExtraModel,
        onRemove: removeExtra,
        devices,
        scan,
        message: messages[kind],
        hint: hintFor(kind)
    });

    return (
        <form onSubmit={handleSubmit} className="return-form">
            <div className="form-group">
                <label>Personne qui rend du matériel</label>
                <PersonNameFields
                    last={lastName}
                    first={firstName}
                    onLastChange={setLastName}
                    onFirstChange={setFirstName}
                />
                {person?.known && (
                    <div className="return-person">
                        <span>Personne connue · {summary}</span>
                        {myDevices.length + givenItems.length > 0 && (
                            <button type="button" className="scan-link" onClick={toggleAll}>
                                {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                            </button>
                        )}
                    </div>
                )}
                {person && !person.known && (
                    <p className="return-person return-person-new">Nouvelle personne : aucun matériel enregistré. Scanne ce qu’elle rapporte.</p>
                )}
            </div>

            <ReturnSection {...sectionProps('pc', pcScan, pcs)} />
            <ReturnSection {...sectionProps('phone', phoneScan, phones)} />

            <div className="form-group">
                <label>Matériel secondaire rendu</label>
                <div className="pill-row">
                    {RETURN_ITEMS.map(({ id }) => {
                        const on = isItemOn(id);
                        return (
                            <button
                                key={id}
                                type="button"
                                className={`pill-toggle${on ? ' active' : ''}`}
                                aria-pressed={on}
                                onClick={() => setItem(id, !on)}
                            >
                                {on ? '✓ ' : ''}{id}
                                {person?.given.has(id) && <small className="pill-hint"> attribué</small>}
                            </button>
                        );
                    })}
                    {caseInfos.length > 0 && (
                        <button
                            type="button"
                            className={`pill-toggle${caseOn ? ' active' : ''}`}
                            aria-pressed={caseOn}
                            onClick={() => patchChoices(() => ({ phoneCase: !caseOn }))}
                        >
                            {caseOn ? '✓ ' : ''}{caseLabel}
                            {caseGiven && <small className="pill-hint"> attribué</small>}
                        </button>
                    )}
                </div>
            </div>

            <button
                type="submit"
                className="btn-add full-width-btn"
                disabled={Boolean(blocker)}
                style={{ background: blocker ? '#cbd5e1' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)', marginTop: '20px' }}
            >
                {blocker || `Valider le retour (${count})`}
            </button>
        </form>
    );
}
