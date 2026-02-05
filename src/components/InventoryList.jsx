import React from 'react';

export default function InventoryList({ items }) {
    if (items.length === 0) {
        return (
            <div className="card empty-state">
                <p>Aucun mouvement récent.</p>
            </div>
        );
    }

    return (
        <div className="card">
            <h2>Historique</h2>
            <ul className="item-list">
                {items.map((item) => (
                    <li key={item.id} className="item-card">
                        <div className="item-info">
                            <h3>{item.name}</h3>
                            <div className="item-meta">
                                Sorti par: <strong>{item.user}</strong>
                            </div>
                        </div>
                        <div className="item-meta">
                            {item.date}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
