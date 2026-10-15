import React, { useMemo, useState } from 'react';
import ModelPicker from './ModelPicker';
import PersonNameFields from './PersonNameFields';
import { PHONE_CASE_INFO } from '../config/phoneAccessories';
import { RETURN_ITEMS } from '../config/secondaryItems';
import { useScanCapture } from '../hooks/useScanCapture';
import { parseScan } from '../utils/scanParse';
import { fullName, nameKey } from '../utils/person';
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
function ReturnSection({ kind, isOpen, onToggle, listed, picked, onPick, added, onModel, onRemove, devices, scan, message, hint }) {
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
                                return (
                                    <li key={device.serial}>
                                        <label className={`return-device${picked[device.serial] ? ' return-device-on' : ''}`}>
                                            <input type="checkbox" checked={Boolean(picked[device.serial])} onChange={() => onPick(device.serial)} />
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
                            placeholder={kind === 'pc' ? 'Scanner un PC (QR code ou n° de série)…' : 'Scanner un téléphone (n° de série)…'}
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

// Retour de matériel : on indique la personne, ce qui lui est attribué apparaît,
// on coche ce qu'elle rapporte, puis le matériel secondaire. Si la personne ou
// l'appareil n'existe pas encore dans l'appli (ou n'est pas attribué à cette
// personne), on le scanne : il entre en stock (Occasion pour un PC).
export default function ReturnForm({ devices, loans, onSubmit, onDone }) {
    const [lastName, setLastName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [open, setOpen] = useState({ pc: null, phone: null }); // null = ouvert si la personne a du matériel de ce type
    const [picked, setPicked] = useState({}); // n° de série -> coché
    const [extras, setExtras] = useState([]); // appareils scannés en plus
    const [items, setItems] = useState({}); // article secondaire -> rendu
    const [phoneCase, setPhoneCase] = useState(false);
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

    const attributed = (kind) => person?.[kind] || [];
    const sectionOpen = (kind) => open[kind] ?? (person ? person[kind].length > 0 || !person.known : false);

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
                setPicked(prev => ({ ...prev, [serial]: true }));
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
        ? { listed: attributed(kind).filter(device => picked[device.serial]), added: extras.filter(entry => entry.kind === kind) }
        : { listed: [], added: [] });
    const pcs = returnedOf('pc');
    const phones = returnedOf('phone');
    const returnedCount = pcs.listed.length + pcs.added.length + phones.listed.length + phones.added.length;
    const itemNames = RETURN_ITEMS.map(item => item.id).filter(id => items[id]);
    const missingModel = [...pcs.added, ...phones.added].some(entry => !entry.known && !entry.model);

    // Coque et vitre : proposées quand un téléphone rendu en a en stock.
    const phoneStockKeys = [
        ...phones.listed.map(device => device.model),
        ...phones.added.map(entry => (entry.known ? devices[entry.serial].model : entry.model ? stockKeyOf(entry.model) : ''))
    ];
    const caseInfos = phoneStockKeys.map(key => PHONE_CASE_INFO[key]).filter(Boolean);
    const caseLabel = caseInfos.length > 0 && caseInfos.every(info => info.bundled) ? 'Coque + Vitre' : 'Coque et Vitre';
    const returnCase = phoneCase && caseInfos.length > 0;

    const count = returnedCount + itemNames.length + (returnCase ? 1 : 0);
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
        onSubmit(name, { returned: [...listed, ...added], items: itemNames, phoneCase: returnCase });
        onDone();
    };

    // --- Tout sélectionner : tout ce qui est attribué à la personne -----------------
    const myDevices = person ? [...person.pc, ...person.phone] : [];
    const givenItems = person ? RETURN_ITEMS.map(item => item.id).filter(id => person.given.has(id)) : [];
    const allSelected = myDevices.length + givenItems.length > 0
        && myDevices.every(device => picked[device.serial]) && givenItems.every(id => items[id]);
    const toggleAll = () => {
        const on = !allSelected;
        setPicked(prev => ({ ...prev, ...Object.fromEntries(myDevices.map(device => [device.serial, on])) }));
        setItems(prev => ({ ...prev, ...Object.fromEntries(givenItems.map(id => [id, on])) }));
        if (on) setOpen(prev => ({ pc: person.pc.length > 0 ? true : prev.pc, phone: person.phone.length > 0 ? true : prev.phone }));
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
        onToggle: (checked) => setOpen(prev => ({ ...prev, [kind]: checked })),
        listed: attributed(kind),
        picked,
        onPick: (serial) => setPicked(prev => ({ ...prev, [serial]: !prev[serial] })),
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
                    {RETURN_ITEMS.map(({ id }) => (
                        <button
                            key={id}
                            type="button"
                            className={`pill-toggle${items[id] ? ' active' : ''}`}
                            aria-pressed={Boolean(items[id])}
                            onClick={() => setItems(prev => ({ ...prev, [id]: !prev[id] }))}
                        >
                            {items[id] ? '✓ ' : ''}{id}
                            {person?.given.has(id) && <small className="pill-hint"> attribué</small>}
                        </button>
                    ))}
                    {caseInfos.length > 0 && (
                        <button
                            type="button"
                            className={`pill-toggle${phoneCase ? ' active' : ''}`}
                            aria-pressed={phoneCase}
                            onClick={() => setPhoneCase(on => !on)}
                        >
                            {phoneCase ? '✓ ' : ''}{caseLabel}
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
