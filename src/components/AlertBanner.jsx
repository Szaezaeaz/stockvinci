import React from 'react';

export default function AlertBanner({ stock }) {
    // Check for low stock on specific items
    // Currently hardcoded for 'Casque' < 5 as requested
    const isLowCasque = (stock['Casque'] || 0) < 5;

    if (!isLowCasque) return null;

    return (
        <div className="alert-banner fade-in">
            <span className="alert-icon">⚠️</span>
            <span className="alert-message">
                <strong>Attention :</strong> Le stock de <strong>Casques</strong> est faible ({stock['Casque']} restants) !
            </span>
        </div>
    );
}
