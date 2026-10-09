import React, { useState } from 'react';
import { PHONE_CASE_INFO, PHONE_MODEL_OPTIONS } from '../config/phoneAccessories';

// Le PC rendu rejoint le stock Occasion de son modèle.
const PC_RETURN_OPTIONS = [
    { value: '650 G11 Occasion', label: '650 G11' },
    { value: '850 G8/G10 Occasion', label: '850 G8/G10' },
    { value: 'X360 Occasion', label: 'X360' },
    { value: 'Zbook Occasion', label: 'Zbook' }
];

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
    const key = serial.trim().toUpperCase();
    const device = key ? devices?.[key] : null;
    if (!device) return null;
    const last = device.events?.[0];
    const when = last ? new Date(last.date).toLocaleDateString() : '';
    return (
        <p style={noteStyle}>
            Déjà enregistré : {device.model}
            {last ? ` · dernier mouvement : ${last.action} par ${last.person} le ${when}` : ''}
        </p>
    );
}

export default function EmployeeReturnForm({ devices, onSubmit, onDone }) {
    const [name, setName] = useState('');

    const [includePC, setIncludePC] = useState(true);
    const [pcModel, setPcModel] = useState(PC_RETURN_OPTIONS[0].value);
    const [pcSerial, setPcSerial] = useState('');

    const [includePhone, setIncludePhone] = useState(false);
    const [phoneModel, setPhoneModel] = useState(PHONE_MODEL_OPTIONS[0]);
    const [phoneSerial, setPhoneSerial] = useState('');
    const [phoneCase, setPhoneCase] = useState(false);

    const [accessories, setAccessories] = useState({});

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
        onSubmit(name.trim(), {
            pcModel: includePC ? pcModel : null,
            pcSerial: includePC ? pcSerial : '',
            phoneModel: includePhone ? phoneModel : null,
            phoneSerial: includePhone ? phoneSerial : '',
            phoneCase: includePhone && phoneCase,
            accessories
        });
        onDone();
    };

    const caseLabel = PHONE_CASE_INFO[phoneModel]?.bundled ? 'Coque + Vitre' : 'Coque et Vitre';

    return (
        <form onSubmit={handleSubmit} className="employee-return-form">
            <div className="form-group">
                <label>Nom du collaborateur</label>
                <input
                    type="text"
                    className="loan-input full-width"
                    placeholder="Ex: Jean Dupont"
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
                        <select className="loan-input full-width" value={pcModel} onChange={(e) => setPcModel(e.target.value)}>
                            {PC_RETURN_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            className="loan-input full-width"
                            style={{ marginTop: '8px' }}
                            placeholder="N° de série du PC (facultatif)"
                            autoCapitalize="characters"
                            autoComplete="off"
                            value={pcSerial}
                            onChange={(e) => setPcSerial(e.target.value)}
                        />
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
                        <select className="loan-input full-width" value={phoneModel} onChange={(e) => setPhoneModel(e.target.value)}>
                            {PHONE_MODEL_OPTIONS.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            className="loan-input full-width"
                            style={{ marginTop: '8px' }}
                            placeholder="N° de série / IMEI (facultatif)"
                            autoCapitalize="characters"
                            autoComplete="off"
                            value={phoneSerial}
                            onChange={(e) => setPhoneSerial(e.target.value)}
                        />
                        <KnownDeviceNote devices={devices} serial={phoneSerial} />
                        <label style={{ ...checkboxRowStyle, marginTop: '10px' }}>
                            <input type="checkbox" checked={phoneCase} onChange={(e) => setPhoneCase(e.target.checked)} />
                            {caseLabel} récupérée
                        </label>
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
