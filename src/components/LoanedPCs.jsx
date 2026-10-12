import React, { useImperativeHandle, useRef, useState } from 'react';
import Modal from './Modal';
import AssignmentPicker from './AssignmentPicker';
import LoanChips from './LoanChips';
import { PHONE_CASE_INFO } from '../config/phoneAccessories';
import { matchesQuery } from '../utils/search';
import { getLoanSerials } from '../utils/loans';

const DEFAULT_ACCESSORIES = {
    mouse: true,
    bag: true,
    backpack: false,
    headset: false,
    screen: false,
    dock: false,
    keyboard: false,
    phoneCase: true,
    phoneScreen: true
};

const ACCESSORY_PILLS = [
    { key: 'mouse', label: 'Souris' },
    { key: 'bag', label: 'Sacoche' },
    { key: 'backpack', label: 'Sac à dos' },
    { key: 'headset', label: 'Casque' },
    { key: 'screen', label: 'Écran' },
    { key: 'dock', label: 'Dock' },
    { key: 'keyboard', label: 'Clavier' }
];

// Volet "À remettre" de l'onglet Attribué : formulaire "Attribuer du matériel" et
// liste du matériel préparé en stock, pas encore remis (bouton "Remis"). La
// liste n'est affichée que si showList ; le formulaire reste disponible.
export default function LoanedPCs({ loans, onAdd, onHandOver, devices, stock, onReceiveDevices, query = '', showList = true, ref }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [scanRaw, setScanRaw] = useState(null); // scan reçu de la page, traité à l'ouverture du formulaire
    const nameRef = useRef(null);
    const [name, setName] = useState('');
    const [items, setItems] = useState([]); // appareils à attribuer (PC, téléphones)
    const [accessories, setAccessories] = useState(DEFAULT_ACCESSORIES);

    // Scan reçu quand aucun champ n'est actif : on ouvre le formulaire et le
    // sélecteur traite le code (appareil ajouté à la liste, ou proposition de le créer).
    useImperativeHandle(ref, () => ({
        openForm() {
            setIsModalOpen(true);
        },
        handleScan(raw) {
            setScanRaw(raw);
            setIsModalOpen(true);
        }
    }));

    // Seul le matériel pas encore remis est listé ici ; le reste est chez les utilisateurs.
    const filteredLoans = loans.filter(loan =>
        !loan.pickedUpAt &&
        matchesQuery(query, [
            loan.name || loan.recipient || '',
            ...(loan.items || []),
            ...getLoanSerials(loan).flatMap(serial => [serial, devices?.[serial]?.exactModel || ''])
        ])
    );

    const toggleAccessory = (key) => setAccessories(prev => ({ ...prev, [key]: !prev[key] }));

    // Pastilles coque / vitre : seulement s'il y a dans la liste un téléphone dont
    // on tient les coques en stock.
    const phones = items.filter(item => item.kind === 'phone');
    const phonesWithCase = phones.filter(phone => PHONE_CASE_INFO[phone.model]);
    const phoneAccessoryPills = [];
    if (phonesWithCase.length > 0) {
        const allBundled = phonesWithCase.every(phone => PHONE_CASE_INFO[phone.model].bundled);
        if (allBundled) {
            phoneAccessoryPills.push({ key: 'phoneCase', label: 'Coque + Vitre' });
        } else {
            phoneAccessoryPills.push({ key: 'phoneCase', label: 'Coque' }, { key: 'phoneScreen', label: 'Vitre' });
        }
    }

    const resetForm = () => {
        setName('');
        setItems([]);
        setAccessories(DEFAULT_ACCESSORIES);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('Indique le nom du collaborateur.');
            return;
        }
        if (items.length === 0) {
            alert('Ajoute au moins un PC ou un téléphone.');
            return;
        }
        // Chaque appareil suivi doit toujours être en stock.
        for (const item of items.filter(i => i.serial)) {
            const device = devices?.[item.serial];
            if (!device || device.status !== 'stock') {
                alert(`${item.serial} n'est plus disponible en stock : retire-le de la liste.`);
                return;
            }
        }
        const toLoanItem = ({ model, serial }) => ({ model, serial });
        onAdd(name.trim(), {
            pcs: items.filter(item => item.kind === 'pc').map(toLoanItem),
            phones: phones.map(toLoanItem),
            accessories
        });
        resetForm();
        setIsModalOpen(false); // Close modal on success
    };

    return (
        <div className={showList ? 'loan-container' : undefined}>
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Attribuer du matériel"
            >
                <form onSubmit={handleSubmit} className="loan-form-modal assign-form">
                    <div className="form-group">
                        <label>Collaborateur</label>
                        <input
                            type="text"
                            className="loan-input full-width"
                            ref={nameRef}
                            placeholder="NOM Prénom"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <AssignmentPicker
                        devices={devices}
                        stock={stock}
                        items={items}
                        onItemsChange={setItems}
                        onCreateDevice={(entry) => onReceiveDevices([entry])}
                        initialScan={scanRaw}
                        onInitialScanHandled={() => {
                            setScanRaw(null);
                            // L'appareil est ajouté : le curseur passe au nom du collaborateur.
                            setTimeout(() => nameRef.current?.focus(), 50);
                        }}
                    />

                    <div className="form-group">
                        <label>Accessoires</label>
                        <div className="pill-row">
                            {[...ACCESSORY_PILLS, ...phoneAccessoryPills].map(({ key, label }) => (
                                <button
                                    key={key}
                                    type="button"
                                    className={`pill-toggle${accessories[key] ? ' active' : ''}`}
                                    onClick={() => toggleAccessory(key)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button type="submit" className="btn-add full-width-btn">
                        Attribuer{items.length > 0 ? ` (${items.length} appareil${items.length > 1 ? 's' : ''})` : ''}
                    </button>
                </form>
            </Modal>

            {showList && (
                <div className="pending-list">
                    {filteredLoans.length === 0 && (
                        <div className="search-empty">{query ? 'Aucun résultat.' : 'Aucun matériel à remettre.'}</div>
                    )}

                    {filteredLoans.map((loan) => (
                        <div key={loan.id} className="person-card pending-card">
                            <div className="person-header">
                                <span className="person-name">{loan.name || loan.recipient}</span>
                                <span className="assignment-badge assignment-badge-pending">
                                    Préparé le {new Date(loan.date).toLocaleDateString()}
                                </span>
                            </div>
                            <LoanChips loan={loan} devices={devices} />
                            <button
                                type="button"
                                className="btn-handover btn-handover-wide"
                                onClick={() => {
                                    if (window.confirm(`Matériel remis à ${loan.name || loan.recipient} ? Il passera dans « Remis ».`)) {
                                        onHandOver(loan.id);
                                    }
                                }}
                            >
                                ✓ Remis à {loan.name || loan.recipient}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
