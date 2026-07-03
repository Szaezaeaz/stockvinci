import React, { useState } from 'react';
import GlobalWithdrawModal from './GlobalWithdrawModal';
import ReturnModal from './ReturnModal';
import LongPressButton from './LongPressButton';
import { LOW_STOCK_THRESHOLD } from '../config/thresholds';

const DASHBOARD_ITEMS = [
    { type: 'group', title: 'PC', items: ['650 G11 Neuf', '650 G11 Occasion', '850 G8 Occasion'], span: 2, icon: '💻' },
    { type: 'group', title: 'TÉLÉPHONES', items: ['iPhone 16e', 'Samsung XCOVER 7', 'Samsung A36'], span: 2, icon: '📱' },
    { type: 'single', id: 'Casque', icon: '🎧' },
    { type: 'single', id: 'Clavier', icon: '⌨️' },
    { type: 'single', id: 'Souris', icon: '🖱️' },
    { type: 'single', id: 'Sacoche', icon: '💼' },
    { type: 'single', id: 'Sac à Dos', icon: '🎒' },
    { type: 'single', id: 'Écran', icon: '🖥️' },
    { type: 'single', id: 'Chargeur', icon: '🔌' },
    { type: 'single', id: 'Dock', icon: '📦' },
];

export default function StockDashboard({
    stock,
    onUpdate,
    onWithdraw,
    loans,
    onReturnLoan,
    onQuickReturnPC
}) {
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

    return (
        <div className="dashboard-grid">
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

            {DASHBOARD_ITEMS.map((item, index) => {
                const spanClass = item.span === 2 ? 'col-span-2' : '';

                if (item.type === 'single') {
                    const isLowStock = (stock[item.id] || 0) < LOW_STOCK_THRESHOLD;
                    return (
                        <div key={item.id} className={`stock-card ${spanClass} ${isLowStock ? 'low-stock' : ''}`}>
                            <h3>{item.icon} {item.id}</h3>
                            <div className={`stock-count ${isLowStock ? 'text-red' : ''}`}>{stock[item.id]}</div>
                            <div className="actions">
                                <LongPressButton
                                    className="btn-circle btn-minus"
                                    ariaLabel={`Retirer ${item.id}`}
                                    onPress={(step) => onUpdate(item.id, -step)}
                                >
                                    -
                                </LongPressButton>
                                <LongPressButton
                                    className="btn-circle btn-plus"
                                    ariaLabel={`Ajouter ${item.id}`}
                                    onPress={(step) => onUpdate(item.id, step)}
                                >
                                    +
                                </LongPressButton>
                            </div>
                        </div>
                    );
                } else if (item.type === 'group') {
                    return (
                        <div key={item.title} className={`stock-card group-card ${spanClass}`}>
                            <h3>{item.icon} {item.title}</h3>
                            <div className="group-content">
                                {item.items.map(subItem => (
                                    <div key={subItem} className="group-row">
                                        <span className="group-label">{subItem}</span>
                                        <div className="group-controls">
                                            <LongPressButton
                                                className="btn-mini btn-minus"
                                                ariaLabel={`Retirer ${subItem}`}
                                                onPress={(step) => onUpdate(subItem, -step)}
                                            >
                                                -
                                            </LongPressButton>
                                            <span className="group-count">{stock[subItem]}</span>
                                            <LongPressButton
                                                className="btn-mini btn-plus"
                                                ariaLabel={`Ajouter ${subItem}`}
                                                onPress={(step) => onUpdate(subItem, step)}
                                            >
                                                +
                                            </LongPressButton>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                }
                return null;
            })}

            {/* Global Withdrawal Card */}
            <div
                className="stock-card interactable-card"
                style={{
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                    border: '1px solid #bae6fd',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '140px'
                }}
                onClick={() => setIsWithdrawModalOpen(true)}
            >
                <div style={{ fontSize: '2.5rem', marginBottom: '10px', color: '#0ea5e9' }}>📤</div>
                <h3 style={{ margin: 0, color: '#0c4a6e', fontSize: '1.2rem', fontWeight: 600 }}>Retrait Matériel</h3>
            </div>

            {/* Global Return Card */}
            <div
                className="stock-card interactable-card"
                style={{
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', // Pastel Green
                    border: '1px solid #bbf7d0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '140px'
                }}
                onClick={() => setIsReturnModalOpen(true)}
            >
                <div style={{ fontSize: '2.5rem', marginBottom: '10px', color: '#22c55e' }}>📥</div>
                <h3 style={{ margin: 0, color: '#14532d', fontSize: '1.2rem', fontWeight: 600 }}>Retour Matériel</h3>
            </div>
        </div>
    );
}
