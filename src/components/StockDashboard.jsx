import React, { useMemo, useState } from 'react';
import GlobalWithdrawModal from './GlobalWithdrawModal';
import ReturnModal from './ReturnModal';
import AddMaterielModal from './AddMaterielModal';
import { getMaxStock, getStockStatus, hasStockLimits } from '../config/thresholds';
import { PHONE_CASE_INFO } from '../config/phoneAccessories';
import { getStockStats } from '../utils/stockStats';
import { IconPhoneCharger } from './icons';
import SearchBar from './SearchBar';
import { matchesQuery } from '../utils/search';

const DASHBOARD_SECTIONS = [
    {
        title: 'PC portables',
        icon: '💻',
        unitLabel: 'modèles',
        items: ['650 G11 Neuf', '850 G8/G10 Occasion', 'X360 Neuf', 'Zbook Neuf'],
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

// PC Neuf -> PC Occasion correspondant, affiché en sous-ligne (le 850 G8/G10
// n'a pas d'équivalent Neuf, il reste une ligne principale à part).
const PC_OCCASION_PAIRS = {
    '650 G11 Neuf': '650 G11 Occasion',
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
function SubRow({ label, itemKey, stock }) {
    const count = stock[itemKey] || 0;
    const limited = hasStockLimits(itemKey);
    const max = limited ? getMaxStock(itemKey) : null;
    const { status, percent } = getStockStatus(itemKey, count);
    return (
        <div className="item-subrow">
            <span className="item-subrow-label">{label}</span>
            <div className="item-subrow-main">
                <div className="item-subrow-bar-track">
                    <div className={`item-subrow-bar-fill status-${status}`} style={{ width: `${percent}%` }} />
                </div>
                <span className={`item-subrow-count status-${status}`}>
                    {count}{limited && <span className="item-count-max"> / {max}</span>}
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
    loans,
    onReturnLoan,
    onQuickReturnPC,
    devices,
    onEmployeeReturn
}) {
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [query, setQuery] = useState('');

    const stats = useMemo(() => getStockStats(stock), [stock]);

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

            <ReturnModal
                isOpen={isReturnModalOpen}
                onClose={() => setIsReturnModalOpen(false)}
                loans={loans}
                onReturnLoan={onReturnLoan}
                onQuickReturnPC={onQuickReturnPC}
                devices={devices}
                onEmployeeReturn={onEmployeeReturn}
            />

            <AddMaterielModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onConfirm={onAddStock}
                stock={stock}
            />

            <div className="action-buttons-row">
                <button type="button" className="action-pill" onClick={() => setIsReturnModalOpen(true)}>
                    <span className="action-pill-icon">↓</span> Entrée
                </button>
                <button type="button" className="action-pill" onClick={() => setIsWithdrawModalOpen(true)}>
                    <span className="action-pill-icon">↑</span> Sortie
                </button>
                <button type="button" className="action-pill action-pill-primary" onClick={() => setIsAddModalOpen(true)}>
                    <span className="action-pill-icon">+</span> Ajout
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

            <SearchBar value={query} onChange={setQuery} placeholder="Rechercher dans le stock…" />

            {visibleSections.length === 0 && <div className="search-empty">Aucun article trouvé.</div>}

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
                                    <div className="item-row">
                                        <span className="item-row-icon">{itemIcon(key, section.icon)}</span>
                                        <div className="item-row-main">
                                            <div className="item-row-top">
                                                <span className="item-row-label">{key}</span>
                                                <span className={`item-row-count status-${status}`}>
                                                    {count}{limited && <span className="item-count-max"> / {max}</span>}
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
                                                <SubRow label="Occasion" itemKey={occasionKey} stock={stock} />
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
