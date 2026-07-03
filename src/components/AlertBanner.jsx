import React from 'react';
import { LOW_STOCK_THRESHOLD } from '../config/thresholds';

export default function AlertBanner({ stock }) {
    const lowItems = Object.entries(stock).filter(([, count]) => (count || 0) < LOW_STOCK_THRESHOLD);

    if (lowItems.length === 0) return null;

    return (
        <div className="alert-banner fade-in">
            <span className="alert-icon">⚠️</span>
            <span className="alert-message">
                <strong>Attention :</strong> Stock faible sur {lowItems.map(([name, count], i) => (
                    <span key={name}>
                        {i > 0 && ', '}
                        <strong>{name}</strong> ({count} restant{count > 1 ? 's' : ''})
                    </span>
                ))} !
            </span>
        </div>
    );
}
