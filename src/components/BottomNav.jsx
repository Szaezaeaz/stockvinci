import React from 'react';
import { IconBox, IconClock, IconSwap } from './icons';

const TABS = [
    { key: 'stock', label: 'Stock', Icon: IconBox },
    { key: 'loans', label: 'Prêts', Icon: IconSwap },
    { key: 'history', label: 'Historique', Icon: IconClock }
];

export default function BottomNav({ activeTab, onChange }) {
    return (
        <nav className="bottom-nav">
            {TABS.map(({ key, label, Icon }) => {
                const isActive = activeTab === key;
                return (
                    <button
                        key={key}
                        type="button"
                        className={`bottom-nav-btn ${isActive ? 'active' : ''}`}
                        onClick={() => onChange(key)}
                    >
                        <span className="bottom-nav-icon"><Icon /></span>
                        <span className="bottom-nav-label">{label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
