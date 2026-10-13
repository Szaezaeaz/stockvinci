import React, { useState } from 'react';
import ModelPicker from './ModelPicker';
import { PHONE_CASE_INFO } from '../config/phoneAccessories';
import { normalizeSerial } from '../utils/serial';
import { parseScan } from '../utils/scanParse';
import { deviceModelLabel, kindOfModel, listModelChoices, modelLabel, modelOf, stockKeyOf } from '../utils/models';
import { useScanCapture } from '../hooks/useScanCapture';

// Modèles présélectionnés : les premiers de la liste de choix.
const DEFAULT_PC_MODEL = listModelChoices().find(name => kindOfModel(name) === 'pc');
const DEFAULT_PHONE_MODEL = listModelChoices().find(name => kindOfModel(name) === 'phone');

const ACCESSORY_OPTIONS = [
    { key: 'mouse', label: 'Souris' },
    { key: 'charger', label: 'Chargeur USB-C' },
    { key: 'headset', label: 'Casque' },
    { key: 'bag', label: 'Sacoche' },
    { key: 'backpack', label: 'Sac à Dos' },
    { key: 'screen', label: 'Écran' },
    { key: 'dock', label: 'Dock' },
    { key: 'keyboard', label: 'Clavier' }
];

const checkboxRowStyle = { display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' };
const noteStyle = { margin: '6px 0 0', fontSize: '0.8rem', color: '#64748b' };

// Si le n° de série est déjà au registre, rappelle ce qu'on sait de cet appareil.
function KnownDeviceNote({ devices, serial }) {
    const key = normalizeSerial(serial);
    const device = key ? devices?.[key] : null;
    if (!device) return null;
    const last = device.events?.[0];
    const when = last ? new Date(last.date).toLocaleDateString() : '';
    const state = device.status === 'assigned' ? `attribué à ${device.holder || '?'}` : 'en stock';
    return (
        <p style={noteStyle}>
            Déjà enregistré : {deviceModelLabel(device)} · {state}
            {last ? ` · dernier mouvement : ${last.action}${last.person ? ` (${last.person})` : ''} le ${when}` : ''}
        </p>
    );
}

export default function EmployeeReturnForm({ devices, onSubmit, onDone }) {
    const [name, setName] = useState('');

    const [includePC, setIncludePC] = useState(true);
    const [pcModel, setPcModel] = useState(DEFAULT_PC_MODEL);
    const [pcQrModel, setPcQrModel] = useState(null); // modèle précis lu dans le QR code
    const [pcSerial, setPcSerial] = useState('');

    const [includePhone, setIncludePhone] = useState(false);
    const [phoneModel, setPhoneModel] = useState(DEFAULT_PHONE_MODEL);
    const [phoneSerial, setPhoneSerial] = useState('');
    const [phoneCase, setPhoneCase] = useState(false);

    const [accessories, setAccessories] = useState({});
    const [pcDetected, setPcDetected] = useState('');
    const [phoneDetected, setPhoneDetected] = useState('');

    // Scan du PC : le n° de série remplit le champ et le modèle se sélectionne
    // tout seul (QR code HP, ou appareil déjà connu du registre).
    const knownModel = (serial, kind) => {
        const exactModel = devices?.[serial]?.exactModel;
        return exactModel && kindOfModel(exactModel) === kind ? modelOf(exactModel) : null;
    };
    const pcScan = useScanCapture({
        value: pcSerial,
        setValue: setPcSerial,
        onScan: (raw) => {
            const scan = parseScan(raw);
            setPcSerial(scan.serial);
            const fromQr = scan.model && kindOfModel(scan.model) === 'pc' ? scan.model : null;
            const detected = (fromQr && modelOf(fromQr)) || knownModel(scan.serial, 'pc');
            setPcQrModel(fromQr);
            if (detected) setPcModel(detected);
            setPcDetected(detected ? `Modèle détecté : ${modelLabel(detected)}` : '');
        }
    });

    // Scan du téléphone : si l'appareil est connu du registre, son modèle est sélectionné.
    const phoneScan = useScanCapture({
        value: phoneSerial,
        setValue: setPhoneSerial,
        onScan: (raw) => {
            const { serial } = parseScan(raw);
            setPhoneSerial(serial);
            const detected = knownModel(serial, 'phone');
            if (detected) setPhoneModel(detected);
            setPhoneDetected(detected ? `Modèle détecté : ${modelLabel(detected)}` : '');
        }
    });

    // Coque et vitre : seulement pour les téléphones dont on les tient en stock.
    const phoneStockKey = stockKeyOf(phoneModel);
    const caseInfo = PHONE_CASE_INFO[phoneStockKey];
    const caseLabel = caseInfo?.bundled ? 'Coque + Vitre' : 'Coque et Vitre';

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('Indiquez le nom du collaborateur.');
            return;
        }
        const hasAccessory = Object.values(accessories).some(Boolean);
        if (!includePC && !includePhone && !hasAccessory) {
            alert('Sélectionnez au moins un matériel rendu.');
            return;
        }
        // Le PC rendu rejoint le stock Occasion de son modèle.
        onSubmit(name.trim(), {
            pcModel: includePC ? stockKeyOf(pcModel, 'Occasion') : null,
            pcExactModel: includePC ? pcQrModel : null,
            pcSerial: includePC ? pcSerial : '',
            phoneModel: includePhone ? phoneStockKey : null,
            phoneSerial: includePhone ? phoneSerial : '',
            phoneCase: includePhone && phoneCase && Boolean(caseInfo),
            accessories
        });
        onDone();
    };


    return (
        <form onSubmit={handleSubmit} className="employee-return-form">
            <div className="form-group">
                <label>Nom du collaborateur</label>
                <input
                    type="text"
                    className="loan-input full-width"
                    placeholder="NOM Prénom"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>

            <div className="form-group">
                <label style={checkboxRowStyle}>
                    <input type="checkbox" checked={includePC} onChange={(e) => setIncludePC(e.target.checked)} />
                    PC rendu
                </label>
                {includePC && (
                    <div style={{ marginTop: '8px' }}>
                        <ModelPicker value={pcModel} onChange={(model) => { setPcModel(model); setPcDetected(''); }} devices={devices} kind="pc" />
                        <input
                            {...pcScan.inputProps}
                            type="text"
                            className="loan-input full-width"
                            style={{ marginTop: '8px' }}
                            placeholder="Scanne le QR code du PC ou saisis son n° de série (facultatif)"
                            autoCapitalize="characters"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                        />
                        {pcDetected && <p style={{ ...noteStyle, color: '#15803d', fontWeight: 600 }}>{pcDetected}</p>}
                        <KnownDeviceNote devices={devices} serial={pcSerial} />
                        <p style={noteStyle}>Le PC rejoint le stock Occasion de ce modèle.</p>
                    </div>
                )}
            </div>

            <div className="form-group">
                <label style={checkboxRowStyle}>
                    <input type="checkbox" checked={includePhone} onChange={(e) => setIncludePhone(e.target.checked)} />
                    Téléphone rendu
                </label>
                {includePhone && (
                    <div style={{ marginTop: '8px' }}>
                        <ModelPicker value={phoneModel} onChange={(model) => { setPhoneModel(model); setPhoneDetected(''); }} devices={devices} kind="phone" />
                        <input
                            {...phoneScan.inputProps}
                            type="text"
                            className="loan-input full-width"
                            style={{ marginTop: '8px' }}
                            placeholder="N° de série / IMEI (facultatif)"
                            autoCapitalize="characters"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                        />
                        {phoneDetected && <p style={{ ...noteStyle, color: '#15803d', fontWeight: 600 }}>{phoneDetected}</p>}
                        <KnownDeviceNote devices={devices} serial={phoneSerial} />
                        {caseInfo && (
                            <label style={{ ...checkboxRowStyle, marginTop: '10px' }}>
                                <input type="checkbox" checked={phoneCase} onChange={(e) => setPhoneCase(e.target.checked)} />
                                {caseLabel} récupérée
                            </label>
                        )}
                    </div>
                )}
            </div>

            <div className="form-group">
                <label>Accessoires rendus :</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 15px', marginTop: '8px' }}>
                    {ACCESSORY_OPTIONS.map(({ key, label }) => (
                        <label key={key} style={checkboxRowStyle}>
                            <input
                                type="checkbox"
                                checked={Boolean(accessories[key])}
                                onChange={(e) => setAccessories(prev => ({ ...prev, [key]: e.target.checked }))}
                            />
                            {label}
                        </label>
                    ))}
                </div>
            </div>

            <button
                type="submit"
                className="btn-add full-width-btn"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', marginTop: '20px' }}
            >
                Valider le retour
            </button>
        </form>
    );
}
