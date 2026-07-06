import React, { useMemo, useState } from 'react';
import GlobalWithdrawModal from './GlobalWithdrawModal';
import ReturnModal from './ReturnModal';
import AddMaterielModal from './AddMaterielModal';
import { getStockStatus } from '../config/thresholds';
import { PHONE_CASE_SHORT_LABELS } from '../config/phoneAccessories';
import { getStockStats } from '../utils/stockStats';

const DASHBOARD_SECTIONS = [
    {
        title: 'PC portables',
        icon: '💻',
        unitLabel: 'modèles',
        items: ['650 G11 Neuf', '650 G11 Occasion', '850 G8/G10 Occasion', 'X360 Neuf', 'Zbook Neuf', 'Zbook Occasion']
    },
    {
        title: 'Téléphones',
        icon: '📱',
        unitLabel: 'modèles',
        items: ['iPhone 16e', 'iPhone 17', 'Samsung XCOVER 7', 'Samsung A36']
    },
    {
        title: 'Coques & Vitres',
        icon: '🛡️',
        unitLabel: 'articles',
        items: ['Coque+Vitre iPhone 16e', 'Coque+Vitre iPhone 17', 'Coque+Vitre Samsung A36', 'Coque Samsung XCOVER 7', 'Vitre Samsung XCOVER 7']
    },
    {
        title: 'Accessoires',
        icon: '🎒',
        unitLabel: 'articles',
        items: ['Casque', 'Clavier', 'Souris', 'Sacoche', 'Sac à Dos', 'Écran', 'Chargeur', 'Dock']
    }
];

const ITEM_ICONS = {
    'Casque': '🎧', 'Clavier': '⌨️', 'Souris': '🖱️', 'Sacoche': '💼', 'Sac à Dos': '🎒',
    'Écran': '🖥️', 'Chargeur': '🔌', 'Dock': '📦'
};

function itemIcon(key, sectionIcon) {
    return ITEM_ICONS[key] || sectionIcon;
}

function itemLabel(key) {
    return PHONE_CASE_SHORT_LABELS[key] || key;
}

export default function StockDashboard({
    stock,
    onWithdraw,
    onAddStock,
    loans,
    onReturnLoan,
    onQuickReturnPC
}) {
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const stats = useMemo(() => getStockStats(stock), [stock]);

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
            />

            <AddMaterielModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onConfirm={onAddStock}
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

            {DASHBOARD_SECTIONS.map(section => (
                <div key={section.title} className="section-card">
                    <div className="section-card-header">
                        <h3>{section.icon} {section.title}</h3>
                        <span className="section-card-count">{section.items.length} {section.unitLabel}</span>
                    </div>
                    <div className="section-card-body">
                        {section.items.map(key => {
                            const count = stock[key] || 0;
                            const { status, percent } = getStockStatus(key, count);
                            return (
                                <div key={key} className="item-row">
                                    <span className="item-row-icon">{itemIcon(key, section.icon)}</span>
                                    <div className="item-row-main">
                                        <div className="item-row-top">
                                            <span className="item-row-label">{itemLabel(key)}</span>
                                            <span className={`item-row-count status-${status}`}>{count}</span>
                                        </div>
                                        <div className="item-row-bar-track">
                                            <div className={`item-row-bar-fill status-${status}`} style={{ width: `${percent}%` }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
