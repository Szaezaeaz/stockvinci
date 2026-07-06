import React from 'react';

export default function Layout({ children, totalUnits }) {
    return (
        <div>
            <header>
                <div className="header-badge">IT</div>
                <div className="header-text">
                    <h1>Inventaire</h1>
                    <p className="header-subtitle">Support informatique · {totalUnits} unités</p>
                </div>
            </header>
            <main className="container">
                {children}
            </main>
        </div>
    );
}
