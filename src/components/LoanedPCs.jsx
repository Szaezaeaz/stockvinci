import React, { useState } from 'react';
import Modal from './Modal';
import { PHONE_CASE_INFO, PHONE_MODEL_OPTIONS } from '../config/phoneAccessories';
import { parseScan } from '../utils/scanParse';
import PcPicker from './PcPicker';

const PC_TYPE_OPTIONS = [
    '650 G11 Neuf',
    '650 G11 Occasion',
    '850 G8/G10 Occasion',
    'X360 Neuf',
    'X360 Occasion',
    'Zbook Neuf',
    'Zbook Occasion'
];

export default function LoanedPCs({ loans, onAdd, onRemove, devices, onReceiveDevices }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [pcSerial, setPcSerial] = useState('');
    const [name, setName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [includePC, setIncludePC] = useState(false);
    const [includePhone, setIncludePhone] = useState(false);

    const [pcType, setPcType] = useState('650 G11 Neuf');
    const [includeMouse, setIncludeMouse] = useState(true);
    const [includeHeadset, setIncludeHeadset] = useState(false);
    const [includeBag, setIncludeBag] = useState(true);
    const [includeBackpack, setIncludeBackpack] = useState(false);
    const [includeScreen, setIncludeScreen] = useState(false);
    const [includeDock, setIncludeDock] = useState(false);
    const [includeKeyboard, setIncludeKeyboard] = useState(false);

    const [phoneType, setPhoneType] = useState(PHONE_MODEL_OPTIONS[0]);
    const [includePhoneCase, setIncludePhoneCase] = useState(true);
    const [includePhoneScreen, setIncludePhoneScreen] = useState(true);

    const filteredLoans = loans.filter(loan =>
        (loan.name || loan.recipient || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // PC du modèle choisi déjà scannés et disponibles en stock.
    const inStockDevices = Object.values(devices || {}).filter(d => d.model === pcType && d.status === 'stock');

    const resetForm = () => {
        setPcSerial('');
        setIncludePC(false);
        setIncludePhone(false);
        setPcType('650 G11 Neuf');
        setIncludeMouse(true);
        setIncludeHeadset(false);
        setIncludeBag(true);
        setIncludeBackpack(false);
        setIncludeScreen(false);
        setIncludeDock(false);
        setIncludeKeyboard(false);
        setPhoneType(PHONE_MODEL_OPTIONS[0]);
        setIncludePhoneCase(true);
        setIncludePhoneScreen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        if (!includePC && !includePhone) {
            alert('Sélectionnez au moins PC ou Téléphone.');
            return;
        }
        // Si des PC de ce modèle sont suivis par n° de série, on attribue un PC précis.
        let serial = '';
        if (includePC && inStockDevices.length > 0) {
            serial = parseScan(pcSerial).serial;
            const device = serial ? devices[serial] : null;
            if (!device) {
                alert("Indique le n° de série du PC remis : scanne son QR code ou choisis-le dans la liste.");
                return;
            }
            if (device.status !== 'stock') {
                alert(`Ce PC (${serial}) n'est pas en stock : ${device.status === 'assigned' ? `il est attribué à ${device.holder || '?'}` : 'état inconnu'}.`);
                return;
            }
            if (device.model !== pcType) {
                alert(`Ce PC (${serial}) est enregistré comme « ${device.model} ». Choisis ce modèle ou un autre PC.`);
                return;
            }
        }
        onAdd(name.trim(), includePC ? pcType : null, includePhone ? phoneType : null, {
            mouse: includeMouse,
            headset: includeHeadset,
            bag: includeBag,
            backpack: includeBackpack,
            screen: includeScreen,
            dock: includeDock,
            keyboard: includeKeyboard,
            phoneCase: includePhoneCase,
            phoneScreen: includePhoneScreen
        }, serial);
        setName('');
        resetForm();
        setIsModalOpen(false); // Close modal on success
    };

    const phoneCaseInfo = PHONE_CASE_INFO[phoneType];

    return (
        <div className="loan-container">
            <div className="loan-header-actions">
                <h2>Matériel à récupérer</h2>
                <button className="btn-add-trigger" onClick={() => setIsModalOpen(true)}>
                    + Nouveau matériel à récupérer
                </button>
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Ajouter du matériel à récupérer"
            >
                <form onSubmit={handleSubmit} className="loan-form-modal">
                    <div className="form-group">
                        <label>Nom du collaborateur</label>
                        <input
                            type="text"
                            className="loan-input full-width"
                            placeholder="Ex: Jean Dupont"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label>Matériel à remettre</label>
                        <div style={{ display: 'flex', gap: '15px', marginTop: '5px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={includePC}
                                    onChange={(e) => setIncludePC(e.target.checked)}
                                />
                                PC
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={includePhone}
                                    onChange={(e) => setIncludePhone(e.target.checked)}
                                />
                                Téléphone
                            </label>
                        </div>
                    </div>

                    {includePC && (
                        <>
                            <div className="form-group">
                                <label>Type de PC</label>
                                <select
                                    className="loan-input full-width"
                                    value={pcType}
                                    onChange={(e) => {
                                        setPcType(e.target.value);
                                        // Le PC choisi ne correspond plus au modèle : on le désélectionne.
                                        if (pcSerial && devices?.[pcSerial]?.model !== e.target.value) setPcSerial('');
                                    }}
                                >
                                    {PC_TYPE_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>

                            <PcPicker
                                devices={devices}
                                pcType={pcType}
                                onModelChange={setPcType}
                                selected={pcSerial}
                                onSelect={setPcSerial}
                                onCreateDevice={(entry) => onReceiveDevices([entry])}
                            />

                            <div className="form-group">
                                <label>Accessoires PC inclus</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 15px', marginTop: '5px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={includeMouse}
                                            onChange={(e) => setIncludeMouse(e.target.checked)}
                                        />
                                        Souris
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={includeBag}
                                            onChange={(e) => setIncludeBag(e.target.checked)}
                                        />
                                        Sacoche
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={includeBackpack}
                                            onChange={(e) => setIncludeBackpack(e.target.checked)}
                                        />
                                        Sac à Dos
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={includeHeadset}
                                            onChange={(e) => setIncludeHeadset(e.target.checked)}
                                        />
                                        Casque
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={includeScreen}
                                            onChange={(e) => setIncludeScreen(e.target.checked)}
                                        />
                                        Écran
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={includeDock}
                                            onChange={(e) => setIncludeDock(e.target.checked)}
                                        />
                                        Dock
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={includeKeyboard}
                                            onChange={(e) => setIncludeKeyboard(e.target.checked)}
                                        />
                                        Clavier
                                    </label>
                                </div>
                            </div>
                        </>
                    )}

                    {includePhone && (
                        <>
                            <div className="form-group">
                                <label>Modèle de téléphone</label>
                                <select
                                    className="loan-input full-width"
                                    value={phoneType}
                                    onChange={(e) => setPhoneType(e.target.value)}
                                >
                                    {PHONE_MODEL_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Accessoires téléphone inclus</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 15px', marginTop: '5px' }}>
                                    {phoneCaseInfo?.bundled ? (
                                        <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={includePhoneCase}
                                                onChange={(e) => setIncludePhoneCase(e.target.checked)}
                                            />
                                            Coque + Vitre
                                        </label>
                                    ) : (
                                        <>
                                            <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={includePhoneCase}
                                                    onChange={(e) => setIncludePhoneCase(e.target.checked)}
                                                />
                                                Coque
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={includePhoneScreen}
                                                    onChange={(e) => setIncludePhoneScreen(e.target.checked)}
                                                />
                                                Vitre
                                            </label>
                                        </>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    <button type="submit" className="btn-add full-width-btn">Confirmer</button>
                </form>
            </Modal>

            <div className="loan-input-group search-group">
                <input
                    type="text"
                    className="loan-input"
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <ul className="loan-list">
                {filteredLoans.length === 0 && <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>
                    {searchQuery ? 'Aucun résultat.' : 'Aucun matériel à récupérer.'}
                </p>}

                {filteredLoans.map((loan) => (
                    <li key={loan.id} className="loan-item">
                        <div className="loan-info">
                            <span className="loan-name">{loan.name || loan.recipient}</span>
                            <div className="loan-meta">
                                {loan.items && loan.items.join(' • ')}
                                {loan.pcSerial ? ` • S/N ${loan.pcSerial}` : ''}
                            </div>
                        </div>
                        <button
                            className="btn-circle btn-remove-loan"
                            onClick={() => onRemove(loan.id)}
                            aria-label="Retourner le matériel"
                        >
                            ×
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
