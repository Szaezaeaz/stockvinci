import React from 'react';

export default function Layout({ children, totalUnits, headerExtra }) {
    return (
        <div>
            <header>
                <img className="header-logo" src="/icon.svg" alt="" width="52" height="52" />
                <div className="header-text">
                    <h1>Inventaire</h1>
                    <p className="header-subtitle">Support informatique · {totalUnits} unités</p>
                </div>
                {headerExtra}
            </header>
            <main className="container">
                {children}
            </main>
        </div>
    );
}
