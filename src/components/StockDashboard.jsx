import React, { useImperativeHandle, useMemo, useState } from 'react';
import { parseScan } from '../utils/scanParse';
import GlobalWithdrawModal from './GlobalWithdrawModal';
import AddMaterielModal from './AddMaterielModal';
import DeviceListModal from './DeviceListModal';
import { TRACKED_MODELS } from '../config/trackedModels';
import { getMaxStock, getStockStatus, hasStockLimits } from '../config/thresholds';
import { PHONE_CASE_INFO } from '../config/phoneAccessories';
import { getStockStats } from '../utils/stockStats';
import { IconPhoneCharger } from './icons';
import SearchBar from './SearchBar';
import { matchesQuery } from '../utils/search';
import { normalizeSerial } from '../utils/serial';
import { deviceFullName, stockKeyLabel } from '../utils/models';

// Au-delà, on demande de préciser la recherche.
const MAX_SERIAL_HITS = 20;

const DASHBOARD_SECTIONS = [
    {
        title: 'PC portables',
        icon: '💻',
        unitLabel: 'modèles',
        items: ['G11 Neuf', 'G8/G10 Occasion', 'X360 Neuf', 'Zbook Neuf'],
        withOccasion: true
    },
    {
        title: 'Téléphones',
        icon: '📱',
        unitLabel: 'modèles',
        items: ['iPhone 16e', 'iPhone 17', 'Samsung XCOVER 7', 'Samsung A36'],
        withCases: true
    },
    {
        title: 'Accessoires',
        icon: '🎒',
        unitLabel: 'articles',
        items: ['Casque', 'Clavier', 'Souris', 'Sacoche', 'Sac à Dos', 'Écran', 'Chargeur USB-C', 'Ancien chargeur', 'Chargeur téléphone', 'Dock']
    }
];

// PC Neuf -> PC Occasion correspondant, affiché en sous-ligne (le G8/G10
// n'a pas d'équivalent Neuf, il reste une ligne principale à part).
const PC_OCCASION_PAIRS = {
    'G11 Neuf': 'G11 Occasion',
    'X360 Neuf': 'X360 Occasion',
    'Zbook Neuf': 'Zbook Occasion'
};

const ITEM_ICONS = {
    'Casque': '🎧', 'Clavier': '⌨️', 'Souris': '🖱️', 'Sacoche': '💼', 'Sac à Dos': '🎒',
    'Écran': '🖥️', 'Chargeur USB-C': '🔌', 'Ancien chargeur': '🔌', 'Chargeur téléphone': <IconPhoneCharger />, 'Dock': '📦'
};

function itemIcon(key, sectionIcon) {
    return ITEM_ICONS[key] || sectionIcon;
}

// Sous-ligne nichée sous un article principal (coque/vitre d'un téléphone,
// ou PC d'occasion sous son modèle Neuf). Les catégories sans seuil/max
// (PC d'occasion) affichent quand même une barre (pleine à 20 unités),
// juste sans le "/ max".
function SubRow({ label, itemKey, stock, onOpen }) {
    const count = stock[itemKey] || 0;
    const limited = hasStockLimits(itemKey);
    const max = limited ? getMaxStock(itemKey) : null;
    const { status, percent } = getStockStatus(itemKey, count);
    return (
        <div className={`item-subrow${onOpen ? ' item-subrow-clickable' : ''}`} onClick={onOpen}>
            <span className="item-subrow-label">{label}</span>
            <div className="item-subrow-main">
                <div className="item-subrow-bar-track">
                    <div className={`item-subrow-bar-fill status-${status}`} style={{ width: `${percent}%` }} />
                </div>
                <span className={`item-subrow-count status-${status}`}>
                    {count}{limited && <span className="item-count-max"> / {max}</span>}
                    {onOpen && <span className="item-row-chevron">›</span>}
                </span>
            </div>
        </div>
    );
}

// Textes supplémentaires retrouvables via la recherche (sous-lignes de l'article).
function searchTerms(section, key) {
    const caseInfo = section.withCases ? PHONE_CASE_INFO[key] : null;
    if (caseInfo) {
        return caseInfo.bundled
            ? [caseInfo.comboItem, 'Coque', 'Vitre']
            : [caseInfo.caseItem, caseInfo.screenItem, 'Coque', 'Vitre'];
    }
    const occasionKey = section.withOccasion ? PC_OCCASION_PAIRS[key] : null;
    return occasionKey ? [occasionKey, 'Occasion'] : [];
}

export default function StockDashboard({
    stock,
    onWithdraw,
    onAddStock,
    devices,
    onOpenReturn,
    onReceiveDevices,
    onRemoveUntracked,
    onDeleteDevice,
    onSetDeviceNote,
    ref
}) {
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [deviceModel, setDeviceModel] = useState(null); // modèle dont on consulte les n° de série
    const [deviceSerial, setDeviceSerial] = useState(null); // appareil dont la fiche s'ouvre d'office (après un scan)
    const [scanForAdd, setScanForAdd] = useState(null); // { raw, key } : scan reçu depuis l'accueil

    const openModel = (model) => {
        setDeviceSerial(null);
        setDeviceModel(model);
    };

    // Scan reçu quand aucun champ n'est actif (voir useGlobalScan dans App) :
    // PC connu -> sa fiche ; PC inconnu -> Ajout > Scanner avec ce code déjà listé.
    useImperativeHandle(ref, () => ({
        handleScan(raw) {
            const { serial } = parseScan(raw);
            if (!serial) return;
            const device = devices?.[serial];
            if (device) {
                setDeviceSerial(serial);
                setDeviceModel(device.model);
            } else {
                setScanForAdd({ raw, key: Date.now() });
                setIsAddModalOpen(true);
            }
        }
    }));

    const stats = useMemo(() => getStockStats(stock), [stock]);

    // La recherche trouve aussi les PC et téléphones par n° de série, quel que soit leur
    // modèle (y compris ceux qui n'ont pas de ligne sur l'accueil) et leur état, ainsi
    // que ceux attribués à une personne dont on tape le nom.
    const serialQuery = normalizeSerial(query);
    const serialHits = useMemo(() => {
        if (query.trim().length < 3) return [];
        return Object.values(devices || {})
            .filter(device => device.serial.includes(serialQuery)
                || (device.status === 'assigned' && matchesQuery(query, [device.holder || '']))
                || (device.note && matchesQuery(query, [device.note])))
            .sort((a, b) => (a.holder || '').localeCompare(b.holder || '', 'fr') || a.serial.localeCompare(b.serial));
    }, [devices, query, serialQuery]);

    // Une ligne reste affichée si la recherche correspond à l'article ou à l'une
    // de ses sous-lignes (coque, vitre, occasion) ; on garde alors tout le bloc.
    const visibleSections = DASHBOARD_SECTIONS
        .map(section => ({
            ...section,
            visibleItems: section.items.filter(key => matchesQuery(query, [key, ...searchTerms(section, key)]))
        }))
        .filter(section => section.visibleItems.length > 0);

    return (
        <div className="stock-view">
            <GlobalWithdrawModal
                isOpen={isWithdrawModalOpen}
                onClose={() => setIsWithdrawModalOpen(false)}
                stock={stock}
                onConfirm={onWithdraw}
            />

            <AddMaterielModal
                key={scanForAdd ? scanForAdd.key : 'manual'}
                isOpen={isAddModalOpen}
                initialScan={scanForAdd ? scanForAdd.raw : null}
                onClose={() => { setIsAddModalOpen(false); setScanForAdd(null); }}
                onConfirm={onAddStock}
                stock={stock}
                devices={devices}
                onReceiveDevices={onReceiveDevices}
            />

            <DeviceListModal
                key={`${deviceModel || 'none'}:${deviceSerial || ''}`}
                model={deviceModel}
                initialSerial={deviceSerial}
                devices={devices}
                stock={stock}
                onClose={() => setDeviceModel(null)}
                onRemoveUntracked={onRemoveUntracked}
                onDeleteDevice={onDeleteDevice}
                onSetDeviceNote={onSetDeviceNote}
            />

            <div className="action-buttons-row">
                <button type="button" className="action-pill" onClick={() => onOpenReturn()}>
                    <span className="action-pill-icon">↩</span> Retour matériels
                </button>
                <button type="button" className="action-pill" onClick={() => setIsWithdrawModalOpen(true)}>
                    <span className="action-pill-icon">↑</span> Sortie accessoires
                </button>
                <button type="button" className="action-pill action-pill-primary" onClick={() => setIsAddModalOpen(true)}>
                    <span className="action-pill-icon">↓</span> Réception stock
                </button>
            </div>

            <div className="stats-row">
                <div className="stat-card stat-card-primary">
                    <span className="stat-card-label">Unités en stock</span>
                    <span className="stat-card-value">{stats.totalUnits}</span>
                    <span className="stat-card-sub">{stats.references} références</span>
                </div>
                <div className="stat-card">
                    <span className="stat-card-dot stat-dot-out" />
                    <span className="stat-card-label">Rupture</span>
                    <span className="stat-card-value stat-value-out">{stats.outOfStock}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-card-dot stat-dot-low" />
                    <span className="stat-card-label">Faible</span>
                    <span className="stat-card-value stat-value-low">{stats.lowStock}</span>
                </div>
            </div>

            <SearchBar value={query} onChange={setQuery} placeholder="Rechercher un article, un n° de série, une personne…" />

            {visibleSections.length === 0 && serialHits.length === 0 && <div className="search-empty">Aucun article trouvé.</div>}

            {serialHits.length > 0 && (
                <div className="section-card">
                    <div className="section-card-header">
                        <h3>🔎 Appareils</h3>
                        <span className="section-card-count">
                            {serialHits.length} appareil{serialHits.length > 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="section-card-body">
                        {serialHits.slice(0, MAX_SERIAL_HITS).map(device => (
                            <button
                                key={device.serial}
                                type="button"
                                className="serial-hit"
                                onClick={() => { setDeviceSerial(device.serial); setDeviceModel(device.model); }}
                            >
                                <span className="serial-hit-main">
                                    <span className="serial-hit-serial">{device.serial}</span>
                                    <span className="serial-hit-sub">{deviceFullName(device)} · ligne {stockKeyLabel(device.model)}</span>
                                    {device.note && <span className="device-note">💬 {device.note}</span>}
                                </span>
                                <span className={`device-badge ${device.status === 'assigned' ? 'device-badge-assigned' : 'device-badge-stock'}`}>
                                    {device.status === 'assigned' ? `Attribué à ${device.holder || '?'}` : 'En stock'}
                                </span>
                            </button>
                        ))}
                        {serialHits.length > MAX_SERIAL_HITS && (
                            <p className="serial-hit-more">{serialHits.length - MAX_SERIAL_HITS} autres : précise la recherche.</p>
                        )}
                    </div>
                </div>
            )}

            {visibleSections.map(section => (
                <div key={section.title} className="section-card">
                    <div className="section-card-header">
                        <h3>{section.icon} {section.title}</h3>
                        <span className="section-card-count">{section.visibleItems.length} {section.unitLabel}</span>
                    </div>
                    <div className="section-card-body">
                        {section.visibleItems.map(key => {
                            const count = stock[key] || 0;
                            const limited = hasStockLimits(key);
                            const max = limited ? getMaxStock(key) : null;
                            const { status, percent } = getStockStatus(key, count);
                            const caseInfo = section.withCases ? PHONE_CASE_INFO[key] : null;
                            const occasionKey = section.withOccasion ? PC_OCCASION_PAIRS[key] : null;
                            return (
                                <div key={key} className="item-row-group">
                                    <div
                                        className={`item-row${TRACKED_MODELS.has(key) ? ' item-row-clickable' : ''}`}
                                        onClick={TRACKED_MODELS.has(key) ? () => openModel(key) : undefined}
                                    >
                                        <span className="item-row-icon">{itemIcon(key, section.icon)}</span>
                                        <div className="item-row-main">
                                            <div className="item-row-top">
                                                <span className="item-row-label">{key}</span>
                                                <span className={`item-row-count status-${status}`}>
                                                    {count}{limited && <span className="item-count-max"> / {max}</span>}
                                                    {TRACKED_MODELS.has(key) && <span className="item-row-chevron">›</span>}
                                                </span>
                                            </div>
                                            <div className="item-row-bar-track">
                                                <div className={`item-row-bar-fill status-${status}`} style={{ width: `${percent}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                    {(caseInfo || occasionKey) && (
                                        <div className="item-subrows">
                                            {caseInfo && (
                                                caseInfo.bundled ? (
                                                    <SubRow label="Coque + Vitre" itemKey={caseInfo.comboItem} stock={stock} />
                                                ) : (
                                                    <>
                                                        <SubRow label="Coque" itemKey={caseInfo.caseItem} stock={stock} />
                                                        <SubRow label="Vitre" itemKey={caseInfo.screenItem} stock={stock} />
                                                    </>
                                                )
                                            )}
                                            {occasionKey && (
                                                <SubRow label="Occasion" itemKey={occasionKey} stock={stock} onOpen={() => openModel(occasionKey)} />
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
