import React, { useImperativeHandle, useRef, useState } from 'react';
import Modal from './Modal';
import { PHONE_CASE_INFO, PHONE_MODEL_OPTIONS } from '../config/phoneAccessories';
import { parseScan } from '../utils/scanParse';
import { matchesQuery } from '../utils/search';
import { getLoanSerials } from '../utils/loans';
import DevicePicker from './DevicePicker';

const PC_TYPE_OPTIONS = [
    '650 G11 Neuf',
    '650 G11 Occasion',
    '850 G8/G10 Occasion',
    'X360 Neuf',
    'X360 Occasion',
    'Zbook Neuf',
    'Zbook Occasion'
];

// Volet "À remettre" de l'onglet Attribué : formulaire "Attribuer du matériel" et
// liste du matériel préparé en stock, pas encore remis (bouton "Remis"). La
// liste n'est affichée que si showList ; le formulaire reste disponible.
export default function LoanedPCs({ loans, onAdd, onHandOver, devices, onReceiveDevices, query = '', showList = true, ref }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [scanRaw, setScanRaw] = useState(null); // scan reçu de la page, traité à l'ouverture du formulaire
    const [scanKind, setScanKind] = useState('pc'); // 'pc' ou 'phone' : quel sélecteur traite ce scan
    const nameRef = useRef(null);
    // Sélecteur (PC ou téléphone) qui reçoit les scans quand le focus est sur une liste
    // déroulante ou un bouton ; les clés forcent le retour du focus sur son champ de scan.
    const [scanTarget, setScanTarget] = useState('pc');
    const [pcFocusKey, setPcFocusKey] = useState(0);
    const [phoneFocusKey, setPhoneFocusKey] = useState(0);
    const [pcSerials, setPcSerials] = useState([]); // PC précis remis (n° de série)
    const [phoneSerials, setPhoneSerials] = useState([]); // téléphone précis remis (0 ou 1)
    const [name, setName] = useState('');

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

    // Scan reçu quand aucun champ n'est actif : on ouvre le formulaire avec "PC"
    // coché ; le sélecteur de PC traite le code (PC choisi, ou proposition de
    // l'ajouter s'il est inconnu).
    useImperativeHandle(ref, () => ({
        openForm() {
            setIsModalOpen(true);
        },
        handleScan(raw) {
            // Un téléphone connu de la base ouvre la partie téléphone ; sinon c'est un PC.
            const known = devices?.[parseScan(raw).serial];
            const isPhone = known?.kind === 'phone';
            setScanKind(isPhone ? 'phone' : 'pc');
            setScanRaw(raw);
            if (isPhone) setIncludePhone(true);
            else setIncludePC(true);
            setIsModalOpen(true);
        }
    }));

    // Seul le matériel pas encore remis est listé ici ; le reste est chez les utilisateurs.
    const filteredLoans = loans.filter(loan =>
        !loan.pickedUpAt &&
        matchesQuery(query, [loan.name || loan.recipient || '', ...(loan.items || []), ...getLoanSerials(loan)])
    );

    // Appareils du modèle choisi déjà scannés et disponibles en stock.
    const inStockDevices = Object.values(devices || {}).filter(d => d.model === pcType && d.status === 'stock');
    const inStockPhones = Object.values(devices || {}).filter(d => d.model === phoneType && d.status === 'stock');

    const resetForm = () => {
        setPcSerials([]);
        setPhoneSerials([]);
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
        // Chaque appareil choisi doit exister et être en stock.
        const checkInStock = (serials, noun) => {
            for (const serial of serials) {
                const device = devices?.[serial];
                if (!device || device.status !== 'stock') {
                    alert(`${noun} ${serial} n'est plus disponible en stock : retire-le de la sélection.`);
                    return false;
                }
            }
            return true;
        };

        // PC : ceux scannés/choisis ; sinon, si des PC de ce modèle sont suivis par n° de
        // série on en exige au moins un, sinon c'est un PC "sans n° de série" (ancien stock).
        let pcs = [];
        if (includePC) {
            if (pcSerials.length > 0) {
                if (!checkInStock(pcSerials, 'Le PC')) return;
                pcs = pcSerials.map(serial => ({ model: devices[serial].model, serial }));
            } else if (inStockDevices.length > 0) {
                alert("Indique le PC remis : scanne son QR code ou choisis-le dans la liste.");
                return;
            } else {
                pcs = [{ model: pcType, serial: '' }];
            }
        }

        // Téléphone : même principe.
        let phoneModel = null;
        let phoneSerial = '';
        if (includePhone) {
            if (phoneSerials.length > 0) {
                if (!checkInStock(phoneSerials, 'Le téléphone')) return;
                phoneSerial = phoneSerials[0];
                phoneModel = devices[phoneSerial].model;
            } else if (inStockPhones.length > 0) {
                alert("Indique le téléphone remis : scanne son QR code ou choisis-le dans la liste.");
                return;
            } else {
                phoneModel = phoneType;
            }
        }

        onAdd(name.trim(), {
            pcs,
            phoneType: phoneModel,
            phoneSerial,
            accessories: {
                mouse: includeMouse,
                headset: includeHeadset,
                bag: includeBag,
                backpack: includeBackpack,
                screen: includeScreen,
                dock: includeDock,
                keyboard: includeKeyboard,
                phoneCase: includePhoneCase,
                phoneScreen: includePhoneScreen
            }
        });
        setName('');
        resetForm();
        setIsModalOpen(false); // Close modal on success
    };

    const phoneCaseInfo = PHONE_CASE_INFO[phoneType];
    // Un seul sélecteur redirige les touches à la fois (sinon les deux se les disputeraient).
    const activeScanTarget = (scanTarget === 'phone' && includePhone) || !includePC ? 'phone' : 'pc';

    return (
        <div className={showList ? 'loan-container' : undefined}>
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Attribuer du matériel"
            >
                <form onSubmit={handleSubmit} className="loan-form-modal">
                    <div className="form-group">
                        <label>Nom du collaborateur</label>
                        <input
                            type="text"
                            className="loan-input full-width"
                            ref={nameRef}
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
                                <label>Type de PC (liste affichée ci-dessous)</label>
                                <select
                                    className="loan-input full-width"
                                    value={pcType}
                                    onChange={(e) => {
                                        setPcType(e.target.value);
                                        e.target.blur(); // sinon la douchette taperait dans la liste
                                        setScanTarget('pc');
                                        setPcFocusKey(key => key + 1);
                                    }}
                                >
                                    {PC_TYPE_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>

                            <DevicePicker
                                kind="pc"
                                multi
                                redirectKeys={activeScanTarget === 'pc'}
                                focusKey={pcFocusKey}
                                devices={devices}
                                model={pcType}
                                onModelChange={setPcType}
                                selected={pcSerials}
                                onChange={setPcSerials}
                                onCreateDevice={(entry) => onReceiveDevices([entry])}
                                initialScan={scanKind === 'pc' ? scanRaw : null}
                                onInitialScanHandled={() => {
                                    setScanRaw(null);
                                    // Le PC est choisi : le curseur passe au nom du collaborateur.
                                    setTimeout(() => nameRef.current?.focus(), 50);
                                }}
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
                                    onChange={(e) => {
                                        setPhoneType(e.target.value);
                                        e.target.blur(); // sinon la douchette taperait dans la liste
                                        setScanTarget('phone');
                                        setPhoneFocusKey(key => key + 1);
                                    }}
                                >
                                    {PHONE_MODEL_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>

                            <DevicePicker
                                kind="phone"
                                redirectKeys={activeScanTarget === 'phone'}
                                focusKey={phoneFocusKey}
                                devices={devices}
                                model={phoneType}
                                onModelChange={setPhoneType}
                                selected={phoneSerials}
                                onChange={setPhoneSerials}
                                onCreateDevice={(entry) => onReceiveDevices([entry])}
                                initialScan={scanKind === 'phone' ? scanRaw : null}
                                onInitialScanHandled={() => {
                                    setScanRaw(null);
                                    setTimeout(() => nameRef.current?.focus(), 50);
                                }}
                            />

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

            {showList && (
            <ul className="loan-list">
                {filteredLoans.length === 0 && <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>
                    {query ? 'Aucun résultat.' : 'Aucun matériel à remettre.'}
                </p>}

                {filteredLoans.map((loan) => (
                    <li key={loan.id} className="loan-item">
                        <div className="loan-info">
                            <span className="loan-name">{loan.name || loan.recipient}</span>
                            <div className="loan-meta">
                                {loan.items && loan.items.join(' • ')}
                                {getLoanSerials(loan).map(serial => ` • S/N ${serial}`).join('')}
                            </div>
                        </div>
                        <button
                            type="button"
                            className="btn-handover"
                            onClick={() => {
                                if (window.confirm(`Matériel remis à ${loan.name || loan.recipient} ? Il passera dans « Remis ».`)) {
                                    onHandOver(loan.id);
                                }
                            }}
                        >
                            Remis
                        </button>
                    </li>
                ))}
            </ul>
            )}
        </div>
    );
}
