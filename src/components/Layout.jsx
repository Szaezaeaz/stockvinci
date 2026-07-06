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
                <button type="button" className="header-search-btn" aria-label="Rechercher">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                </button>
            </header>
            <main className="container">
                {children}
            </main>
        </div>
    );
}
